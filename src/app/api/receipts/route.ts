import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, error, getBody, requireCompanyId, requirePermission } from "@/lib/api-utils";
import { nextSequence } from "@/lib/sequence";

export async function GET(request: NextRequest) {
  try {
    const perm = await requirePermission(request, "receipts");
    if (perm) return perm;
    const { searchParams } = new URL(request.url);
    const salesContractId = searchParams.get("salesContractId");
    const search = searchParams.get("search");
    const companyId = requireCompanyId(request);

    const where: any = { companyId };
    if (salesContractId) where.salesContractId = salesContractId;
    if (search) {
      where.OR = [
        { description: { contains: search } },
        { salesContract: { contractName: { contains: search } } },
        { salesContract: { contractNo: { contains: search } } },
        { salesContract: { customerName: { contains: search } } },
        { salesContract: { purchasePackage: { name: { contains: search } } } },
        { salesContract: { purchasePackage: { project: { name: { contains: search } } } } },
      ];
    }

    const receipts = await prisma.receipt.findMany({
      where,
      include: {
        salesContract: {
          select: {
            id: true, contractNo: true, contractName: true, customerName: true,
            purchasePackage: { select: { name: true, code: true, project: { select: { id: true, name: true } } } },
          },
        },
      },
      orderBy: { receiptDate: "desc" },
    });

    const result = receipts.map((r) => ({
      ...r,
      amount: Number(r.amount),
    }));

    return success(result);
  } catch (e) {
    return error(e instanceof Error ? e.message : "获取收款记录列表失败");
  }
}

export async function POST(request: NextRequest) {
  try {
    const perm = await requirePermission(request, "receipts");
    if (perm) return perm;
    const body = await getBody(request);
    const { salesContractId, receiptNo, amount, receiptDate, paymentMethod, description, ofdFilePath, ofdOriginalName } = body as {
      salesContractId: string;
      receiptNo?: string;
      amount: number;
      receiptDate: string;
      paymentMethod?: string;
      description?: string;
      ofdFilePath?: string;
      ofdOriginalName?: string;
    };
    const companyId = requireCompanyId(request);

    if (!salesContractId || amount === undefined || !receiptDate) {
      return error("合同ID、金额、收款日期为必填项");
    }

    const now = new Date();
    const ym = now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, "0");
    const [existingPayments, existingReceipts] = await Promise.all([
      prisma.payment.findMany({ where: { paymentNo: { startsWith: ym } }, select: { paymentNo: true } }),
      prisma.receipt.findMany({ where: { receiptNo: { startsWith: ym } }, select: { receiptNo: true } }),
    ]);
    const existingNos = [
      ...existingPayments.map(r => r.paymentNo!).filter(Boolean),
      ...existingReceipts.map(r => r.receiptNo!).filter(Boolean),
    ];
    const finalReceiptNo = receiptNo || await nextSequence("transaction", existingNos);

    const receipt = await prisma.receipt.create({
      data: {
        salesContractId,
        companyId,
        receiptNo: finalReceiptNo,
        amount,
        receiptDate: new Date(receiptDate),
        paymentMethod: (paymentMethod as any) || "BANK_TRANSFER",
        description,
        ofdFilePath,
        ofdOriginalName,
      },
      include: {
        salesContract: {
          select: { id: true, contractNo: true, contractName: true },
        },
      },
    });
    return success({ ...receipt, amount: Number(receipt.amount) }, 201);
  } catch (e) {
    return error(e instanceof Error ? e.message : "创建收款记录失败");
  }
}
