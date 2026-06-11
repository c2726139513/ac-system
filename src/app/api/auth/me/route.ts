import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { error } from "@/lib/api-utils";
import { verify } from "@/lib/jwt";

export async function GET(request: NextRequest) {
  try {
    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return error("未登录", 401);
    }

    const token = auth.slice(7);
    const payload = await verify(token);
    if (!payload) {
      return error("登录已过期", 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub as string },
      include: { role: true },
    });

    if (!user || !user.active) {
      return error("用户不存在或已禁用", 401);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role?.name || "",
        permissions: user.role?.permissions || "",
      },
    });
  } catch {
    return error("验证失败", 401);
  }
}
