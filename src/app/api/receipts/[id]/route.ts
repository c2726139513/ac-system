import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, error, getBody, requireCompanyId, requirePermission } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const perm = await requirePermission(request, "receipts");
    if (perm) return perm;
    const { id } = await params;
    const companyId = requireCompanyId(request);
    const receipt = await prisma.receipt.findFirst({
      where: { id, companyId },
      include: {
        salesContract: { select: { id: true, contractNo: true, contractName: true } },
      },
    });
    if (!receipt) return error("收款记录不存在", 404);
    return success({ ...receipt, amount: Number(receipt.amount) });
  } catch (e) {
    return error(e instanceof Error ? e.message : "获取收款记录失败");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const perm = await requirePermission(request, "receipts");
    if (perm) return perm;
    const { id } = await params;
    const companyId = requireCompanyId(request);
    const body = await getBody(request);
    const { amount, receiptDate, paymentMethod, description } = body as any;

    const existing = await prisma.receipt.findFirst({ where: { id, companyId } });
    if (!existing) return error("收款记录不存在", 404);

    const receipt = await prisma.receipt.update({
      where: { id },
      data: {
        ...(amount !== undefined && { amount }),
        ...(receiptDate !== undefined && { receiptDate: new Date(receiptDate) }),
        ...(paymentMethod !== undefined && { paymentMethod }),
        ...(description !== undefined && { description }),
      },
    });
    return success({ ...receipt, amount: Number(receipt.amount) });
  } catch (e) {
    return error(e instanceof Error ? e.message : "更新收款记录失败");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const perm = await requirePermission(request, "receipts");
    if (perm) return perm;
    const { id } = await params;
    const companyId = requireCompanyId(request);
    const existing = await prisma.receipt.findFirst({ where: { id, companyId } });
    if (!existing) return error("收款记录不存在", 404);
    await prisma.receipt.delete({ where: { id } });
    return success({ deleted: true });
  } catch (e) {
    return error(e instanceof Error ? e.message : "删除收款记录失败");
  }
}
