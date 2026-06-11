import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, error, getBody, requireCompanyId, requirePermission } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const perm = await requirePermission(request, "purchase-packages");
    if (perm) return perm;
    const { id } = await params;
    const companyId = requireCompanyId(request);
    const pkg = await prisma.purchasePackage.findFirst({
      where: { id, companyId },
      include: {
        project: { select: { id: true, name: true, code: true } },
        purchaseContracts: {
          include: {
            supplier: { select: { id: true, name: true } },
            payments: { select: { amount: true } },
            invoices: { select: { totalAmount: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        salesContracts: {
          include: {
            customer: { select: { id: true, name: true } },
            receipts: { select: { amount: true } },
            invoices: { select: { totalAmount: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!pkg) return error("采购包不存在", 404);

    const result = {
      ...pkg,
      amount: Number(pkg.amount),
      purchaseContracts: pkg.purchaseContracts.map((c) => {
        const totalPaid = c.payments.reduce((s, p) => s + Number(p.amount), 0);
        const totalInvoiced = c.invoices.reduce((s, i) => s + Number(i.totalAmount), 0);
        const { payments, invoices, ...rest } = c;
        return { ...rest, totalPaid, totalInvoiced, amount: Number(c.amount) };
      }),
      salesContracts: pkg.salesContracts.map((c) => {
        const totalReceived = c.receipts.reduce((s, r) => s + Number(r.amount), 0);
        const totalInvoiced = c.invoices.reduce((s, i) => s + Number(i.totalAmount), 0);
        const { receipts, invoices, ...rest } = c;
        return { ...rest, totalReceived, totalInvoiced, amount: Number(c.amount) };
      }),
    };
    return success(result);
  } catch (e) {
    return error(e instanceof Error ? e.message : "获取采购包详情失败");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const perm = await requirePermission(request, "purchase-packages");
    if (perm) return perm;
    const { id } = await params;
    const companyId = requireCompanyId(request);
    const body = await getBody(request);
    const { name, code, description, amount, status } = body as any;

    const existing = await prisma.purchasePackage.findFirst({ where: { id, companyId } });
    if (!existing) return error("采购包不存在", 404);

    const pkg = await prisma.purchasePackage.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(description !== undefined && { description }),
        ...(amount !== undefined && { amount }),
        ...(status !== undefined && { status }),
      },
      include: { project: { select: { id: true, name: true, code: true } } },
    });
    return success(pkg);
  } catch (e) {
    return error(e instanceof Error ? e.message : "更新采购包失败");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const perm = await requirePermission(request, "purchase-packages");
    if (perm) return perm;
    const { id } = await params;
    const companyId = requireCompanyId(request);
    const existing = await prisma.purchasePackage.findFirst({ where: { id, companyId } });
    if (!existing) return error("采购包不存在", 404);
    await prisma.purchasePackage.delete({ where: { id } });
    return success({ deleted: true });
  } catch (e) {
    return error(e instanceof Error ? e.message : "删除采购包失败");
  }
}
