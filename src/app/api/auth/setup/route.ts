import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, error, getBody } from "@/lib/api-utils";

export async function GET() {
  try {
    const userCount = await prisma.user.count();
    return success({ needsSetup: userCount === 0 });
  } catch {
    return error("检查失败");
  }
}

export async function POST(request: NextRequest) {
  try {
    const existingUsers = await prisma.user.count();
    if (existingUsers > 0) {
      return error("系统已初始化，不能重复创建管理员");
    }

    const body = await getBody(request);
    const { username, password, name } = body as {
      username: string; password: string; name: string;
    };

    if (!username || !password || !name) {
      return error("用户名、密码、姓名为必填项");
    }

    // Create default admin role if none exists
    let role = await prisma.role.findFirst({ where: { name: "管理员" } });
    if (!role) {
      role = await prisma.role.create({
        data: { name: "管理员", description: "系统管理员", permissions: "[]" },
      });
    }

    const bcrypt = await import("bcryptjs");
    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { username, password: hashed, name, roleId: role.id },
    });

    return success({
      id: user.id, username: user.username, name: user.name,
      role: role.name, permissions: role.permissions,
    }, 201);
  } catch (e) {
    return error(e instanceof Error ? e.message : "初始化失败");
  }
}
