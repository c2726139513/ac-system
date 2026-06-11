import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, error, getBody, requireCompanyId, requirePermission } from "@/lib/api-utils";
import { nextSequence } from "@/lib/sequence";

export async function GET(request: NextRequest) {
  try {
    const perm = await requirePermission(request, "invoices");
    if (perm) return perm;
    const { searchParams } = new URL(request.url);
    const purchaseContractId = searchParams.get("purchaseContractId");
    const search = searchParams.get("search");
    const companyId = requireCompanyId(request);

    const where: any = { companyId };
    if (purchaseContractId) where.purchaseContractId = purchaseContractId;
    if (search) {
      where.OR = [
        { invoiceNo: { contains: search } },
        { invoiceCode: { contains: search } },
        { purchaseContract: { contractName: { contains: search } } },
        { purchaseContract: { contractNo: { contains: search } } },
        { purchaseContract: { supplierName: { contains: search } } },
        { purchaseContract: { purchasePackage: { name: { contains: search } } } },
        { purchaseContract: { purchasePackage: { project: { name: { contains: search } } } } },
      ];
    }

    const invoices = await prisma.purchaseInvoice.findMany({
      where,
      include: {
        purchaseContract: {
          select: {
            id: true, contractNo: true, contractName: true,
            purchasePackage: { select: { name: true, code: true, project: { select: { id: true, name: true } } } },
          },
        },
      },
      orderBy: { invoiceDate: "desc" },
    });

    const result = invoices.map((i) => ({
      ...i,
      amount: Number(i.amount),
      taxAmount: Number(i.taxAmount),
      totalAmount: Number(i.totalAmount),
    }));

    return success(result);
  } catch (e) {
    return error(e instanceof Error ? e.message : "获取采购发票列表失败");
  }
}

export async function POST(request: NextRequest) {
  try {
    const perm = await requirePermission(request, "invoices");
    if (perm) return perm;
    const body = await getBody(request);
    const { purchaseContractId, invoiceNo, invoiceCode, invoiceDate, amount, taxAmount, totalAmount, sellerName, buyerName, invoiceType, description, ofdFilePath, ofdOriginalName } = body as {
      purchaseContractId: string;
      invoiceNo?: string;
      invoiceCode?: string;
      invoiceDate: string;
      amount: number;
      taxAmount: number;
      totalAmount: number;
      sellerName?: string;
      buyerName?: string;
      invoiceType?: string;
      description?: string;
      ofdFilePath?: string;
      ofdOriginalName?: string;
    };
    const companyId = requireCompanyId(request);

    if (!purchaseContractId || !invoiceDate || amount === undefined) {
      return error("合同ID、开票日期、金额为必填项");
    }

    if (invoiceNo) {
      const salesWithSameNo = await prisma.salesInvoice.findFirst({ where: { invoiceNo }, select: { id: true } });
      if (salesWithSameNo) return error("发票号码已被销售发票使用");
    }

    const now = new Date();
    const ym = now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, "0");
    const [existingPurchInvoices, existingSalesInvoices] = await Promise.all([
      prisma.purchaseInvoice.findMany({ where: { invoiceNo: { startsWith: ym } }, select: { invoiceNo: true } }),
      prisma.salesInvoice.findMany({ where: { invoiceNo: { startsWith: ym } }, select: { invoiceNo: true } }),
    ]);
    const existingNos = [
      ...existingPurchInvoices.map(r => r.invoiceNo).filter(Boolean),
      ...existingSalesInvoices.map(r => r.invoiceNo).filter(Boolean),
    ];
    const finalInvoiceNo = invoiceNo || await nextSequence("invoice", existingNos);

    const invoice = await prisma.purchaseInvoice.create({
      data: {
        purchaseContractId,
        companyId,
        invoiceNo: finalInvoiceNo,
        invoiceCode,
        invoiceDate: new Date(invoiceDate),
        amount,
        taxAmount: taxAmount || 0,
        totalAmount: totalAmount || amount,
        sellerName,
        buyerName,
        invoiceType: (invoiceType as any) || "SPECIAL",
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
    return success({
      ...invoice,
      amount: Number(invoice.amount),
      taxAmount: Number(invoice.taxAmount),
      totalAmount: Number(invoice.totalAmount),
    }, 201);
  } catch (e: any) {
    if (e?.code === "P2002") return error("发票号码已存在");
    return error(e instanceof Error ? e.message : "创建采购发票失败");
  }
}
