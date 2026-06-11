import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, error, getBody, requireCompanyId, requirePermission } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const perm = await requirePermission(request, "payments");
    if (perm) return perm;
    const { id } = await params;
    const companyId = requireCompanyId(request);
    const payment = await prisma.payment.findFirst({
      where: { id, companyId },
      include: {
        purchaseContract: { select: { id: true, contractNo: true, contractName: true } },
      },
    });
    if (!payment) return error("付款记录不存在", 404);
    return success({ ...payment, amount: Number(payment.amount) });
  } catch (e) {
    return error(e instanceof Error ? e.message : "获取付款记录失败");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const perm = await requirePermission(request, "payments");
    if (perm) return perm;
    const { id } = await params;
    const companyId = requireCompanyId(request);
    const body = await getBody(request);
    const { amount, paymentDate, paymentMethod, description } = body as any;

    const existing = await prisma.payment.findFirst({ where: { id, companyId } });
    if (!existing) return error("付款记录不存在", 404);

    const payment = await prisma.payment.update({
      where: { id },
      data: {
        ...(amount !== undefined && { amount }),
        ...(paymentDate !== undefined && { paymentDate: new Date(paymentDate) }),
        ...(paymentMethod !== undefined && { paymentMethod }),
        ...(description !== undefined && { description }),
      },
    });
    return success({ ...payment, amount: Number(payment.amount) });
  } catch (e) {
    return error(e instanceof Error ? e.message : "更新付款记录失败");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const perm = await requirePermission(request, "payments");
    if (perm) return perm;
    const { id } = await params;
    const companyId = requireCompanyId(request);
    const existing = await prisma.payment.findFirst({ where: { id, companyId } });
    if (!existing) return error("付款记录不存在", 404);
    await prisma.payment.delete({ where: { id } });
    return success({ deleted: true });
  } catch (e) {
    return error(e instanceof Error ? e.message : "删除付款记录失败");
  }
}
