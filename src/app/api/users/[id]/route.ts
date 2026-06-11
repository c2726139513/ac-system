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
    const { username, password, name, roleId, active } = body as any;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return error("用户不存在", 404);

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (roleId !== undefined) data.roleId = roleId;
    if (active !== undefined) data.active = active;
    if (username !== undefined) {
      const dup = await prisma.user.findUnique({ where: { username } });
      if (dup && dup.id !== id) return error("用户名已存在");
      data.username = username;
    }
    if (password) {
      const bcrypt = await import("bcryptjs");
      data.password = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      include: { role: { select: { id: true, name: true } } },
    });

    return success({
      id: user.id,
      username: user.username,
      name: user.name,
      roleId: user.roleId,
      roleName: user.role.name,
      active: user.active,
    });
  } catch (e) {
    return error(e instanceof Error ? e.message : "更新用户失败");
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
    await prisma.user.delete({ where: { id } });
    return success({ deleted: true });
  } catch (e) {
    return error(e instanceof Error ? e.message : "删除用户失败");
  }
}
