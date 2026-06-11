import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, error, getBody, requireCompanyId, requirePermission } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const perm = await requirePermission(request, "invoices");
    if (perm) return perm;
    const { id } = await params;
    const companyId = requireCompanyId(request);
    const invoice = await prisma.salesInvoice.findFirst({
      where: { id, companyId },
      include: {
        salesContract: {
          select: { id: true, contractNo: true, contractName: true },
        },
      },
    });
    if (!invoice) return error("销售发票不存在", 404);
    return success({
      ...invoice,
      amount: Number(invoice.amount),
      taxAmount: Number(invoice.taxAmount),
      totalAmount: Number(invoice.totalAmount),
    });
  } catch (e) {
    return error(e instanceof Error ? e.message : "获取销售发票详情失败");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const perm = await requirePermission(request, "invoices");
    if (perm) return perm;
    const { id } = await params;
    const companyId = requireCompanyId(request);
    const body = await getBody(request);
    const { invoiceNo, invoiceCode, invoiceDate, amount, taxAmount, totalAmount, sellerName, buyerName, invoiceType, description } = body as any;

    const existing = await prisma.salesInvoice.findFirst({ where: { id, companyId } });
    if (!existing) return error("销售发票不存在", 404);

    const invoice = await prisma.salesInvoice.update({
      where: { id },
      data: {
        ...(invoiceNo !== undefined && { invoiceNo }),
        ...(invoiceCode !== undefined && { invoiceCode }),
        ...(invoiceDate !== undefined && { invoiceDate: new Date(invoiceDate) }),
        ...(amount !== undefined && { amount }),
        ...(taxAmount !== undefined && { taxAmount }),
        ...(totalAmount !== undefined && { totalAmount }),
        ...(sellerName !== undefined && { sellerName }),
        ...(buyerName !== undefined && { buyerName }),
        ...(invoiceType !== undefined && { invoiceType }),
        ...(description !== undefined && { description }),
      },
      include: {
        salesContract: {
          select: { id: true, contractNo: true, contractName: true },
        },
      },
    });
    return success({
      ...invoice,
      amount: Number(invoice.amount),
      taxAmount: Number(invoice.taxAmount),
      totalAmount: Number(invoice.totalAmount),
    });
  } catch (e: any) {
    if (e?.code === "P2002") return error("发票号码已存在");
    return error(e instanceof Error ? e.message : "更新销售发票失败");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const perm = await requirePermission(request, "invoices");
    if (perm) return perm;
    const { id } = await params;
    const companyId = requireCompanyId(request);
    const existing = await prisma.salesInvoice.findFirst({ where: { id, companyId } });
    if (!existing) return error("销售发票不存在", 404);
    await prisma.salesInvoice.delete({ where: { id } });
    return success({ deleted: true });
  } catch (e) {
    return error(e instanceof Error ? e.message : "删除销售发票失败");
  }
}
