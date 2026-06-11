import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { error } from "@/lib/api-utils";
import { sign } from "@/lib/jwt";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return error("用户名和密码不能为空");
    }

    const user = await prisma.user.findUnique({
      where: { username },
      include: { role: true },
    });

    if (!user || !user.active) {
      return error("用户名或密码错误", 401);
    }

    const bcrypt = await import("bcryptjs");
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return error("用户名或密码错误", 401);
    }

    const token = await sign({
      sub: user.id,
      username: user.username,
      name: user.name,
      roleId: user.roleId,
      permissions: user.role?.permissions || "",
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    });

    return NextResponse.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role?.name || "",
          permissions: user.role?.permissions || "",
        },
      },
    });
  } catch (e) {
    return error(e instanceof Error ? e.message : "登录失败");
  }
}
