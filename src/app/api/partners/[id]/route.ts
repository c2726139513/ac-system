import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, error, getBody, requirePermission } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const perm = await requirePermission(request, "partners");
    if (perm) return perm;
    const { id } = await params;
    const partner = await prisma.partner.findUnique({ where: { id } });
    if (!partner) return error("伙伴不存在", 404);
    return success(partner);
  } catch (e) {
    return error(e instanceof Error ? e.message : "获取伙伴详情失败");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const perm = await requirePermission(request, "partners");
    if (perm) return perm;
    const { id } = await params;
    const body = await getBody(request);
    const { name, type, contactPerson, phone, email, address, notes, active } = body as any;

    const existing = await prisma.partner.findUnique({ where: { id } });
    if (!existing) return error("伙伴不存在", 404);

    const partner = await prisma.partner.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(contactPerson !== undefined && { contactPerson }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(address !== undefined && { address }),
        ...(notes !== undefined && { notes }),
        ...(active !== undefined && { active }),
      },
    });
    return success(partner);
  } catch (e) {
    return error(e instanceof Error ? e.message : "更新伙伴失败");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const perm = await requirePermission(request, "partners");
    if (perm) return perm;
    const { id } = await params;
    await prisma.partner.delete({ where: { id } });
    return success({ deleted: true });
  } catch (e) {
    return error(e instanceof Error ? e.message : "删除伙伴失败");
  }
}
