import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, error, getBody, requireCompanyId, requirePermission } from "@/lib/api-utils";
import { nextSequence } from "@/lib/sequence";

export async function GET(request: NextRequest) {
  try {
    const perm = await requirePermission(request, "payments");
    if (perm) return perm;
    const { searchParams } = new URL(request.url);
    const purchaseContractId = searchParams.get("purchaseContractId");
    const search = searchParams.get("search");
    const companyId = requireCompanyId(request);

    const where: any = { companyId };
    if (purchaseContractId) where.purchaseContractId = purchaseContractId;
    if (search) {
      where.OR = [
        { description: { contains: search } },
        { purchaseContract: { contractName: { contains: search } } },
        { purchaseContract: { contractNo: { contains: search } } },
        { purchaseContract: { supplierName: { contains: search } } },
        { purchaseContract: { purchasePackage: { name: { contains: search } } } },
        { purchaseContract: { purchasePackage: { project: { name: { contains: search } } } } },
      ];
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        purchaseContract: {
          select: {
            id: true, contractNo: true, contractName: true, supplierName: true,
            purchasePackage: { select: { name: true, code: true, project: { select: { id: true, name: true } } } },
          },
        },
      },
      orderBy: { paymentDate: "desc" },
    });

    const result = payments.map((p) => ({
      ...p,
      amount: Number(p.amount),
    }));

    return success(result);
  } catch (e) {
    return error(e instanceof Error ? e.message : "获取付款记录列表失败");
  }
}

export async function POST(request: NextRequest) {
  try {
    const perm = await requirePermission(request, "payments");
    if (perm) return perm;
    const body = await getBody(request);
    const { purchaseContractId, paymentNo, amount, paymentDate, paymentMethod, description, ofdFilePath, ofdOriginalName } = body as {
      purchaseContractId: string;
      paymentNo?: string;
      amount: number;
      paymentDate: string;
      paymentMethod?: string;
      description?: string;
      ofdFilePath?: string;
      ofdOriginalName?: string;
    };
    const companyId = requireCompanyId(request);

    if (!purchaseContractId || amount === undefined || !paymentDate) {
      return error("合同ID、金额、付款日期为必填项");
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
    const finalPaymentNo = paymentNo || await nextSequence("transaction", existingNos);

    const payment = await prisma.payment.create({
      data: {
        purchaseContractId,
        companyId,
        paymentNo: finalPaymentNo,
        amount,
        paymentDate: new Date(paymentDate),
        paymentMethod: (paymentMethod as any) || "BANK_TRANSFER",
        description,
        ofdFilePath,
        ofdOriginalName,
      },
      include: {
        purchaseContract: {
          select: { id: true, contractNo: true, contractName: true },
        },
      },
    });
    return success({ ...payment, amount: Number(payment.amount) }, 201);
  } catch (e) {
    return error(e instanceof Error ? e.message : "创建付款记录失败");
  }
}
