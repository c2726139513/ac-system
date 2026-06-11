import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, error, getBody, requirePermission } from "@/lib/api-utils";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const perm = await requirePermission(request, "users");
    if (perm) return perm;
    const { id } = await params;
    const body = await getBody(request);
    const { name, description, permissions } = body as any;

    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) return error("角色不存在", 404);

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (permissions !== undefined) data.permissions = JSON.stringify(permissions);

    const role = await prisma.role.update({
      where: { id },
      data,
    });

    return success({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions ? JSON.parse(role.permissions) : [],
    });
  } catch (e) {
    return error(e instanceof Error ? e.message : "更新角色失败");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const perm = await requirePermission(request, "users");
    if (perm) return perm;
    const { id } = await params;
    const users = await prisma.user.count({ where: { roleId: id } });
    if (users > 0) return error("该角色下仍有用户，无法删除");
    await prisma.role.delete({ where: { id } });
    return success({ deleted: true });
  } catch (e) {
    return error(e instanceof Error ? e.message : "删除角色失败");
  }
}
