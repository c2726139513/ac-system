import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, error, getBody, requirePermission } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const perm = await requirePermission(request, "users");
    if (perm) return perm;
    const users = await prisma.user.findMany({
      include: { role: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    const result = users.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      roleId: u.roleId,
      roleName: u.role.name,
      active: u.active,
      createdAt: u.createdAt,
    }));
    return success(result);
  } catch (e) {
    return error(e instanceof Error ? e.message : "获取用户列表失败");
  }
}

export async function POST(request: NextRequest) {
  try {
    const perm = await requirePermission(request, "users");
    if (perm) return perm;
    const body = await getBody(request);
    const { username, password, name, roleId } = body as {
      username: string;
      password: string;
      name: string;
      roleId: string;
    };

    if (!username || !password || !name || !roleId) {
      return error("用户名、密码、姓名、角色为必填项");
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) return error("用户名已存在");

    const bcrypt = await import("bcryptjs");
    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { username, password: hashed, name, roleId },
      include: { role: { select: { id: true, name: true } } },
    });

    return success({
      id: user.id,
      username: user.username,
      name: user.name,
      roleId: user.roleId,
      roleName: user.role.name,
      active: user.active,
    }, 201);
  } catch (e) {
    return error(e instanceof Error ? e.message : "创建用户失败");
  }
}
