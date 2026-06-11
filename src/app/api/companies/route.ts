import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, error, getBody, requirePermission } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const companies = await prisma.company.findMany({
      where: { active: true },
      orderBy: { createdAt: "asc" },
    });
    return success(companies);
  } catch (e) {
    return error(e instanceof Error ? e.message : "获取公司列表失败");
  }
}

export async function POST(request: NextRequest) {
  try {
    const perm = await requirePermission(request, "companies");
    if (perm) return perm;
    const body = await getBody(request);
    const { name, taxId, address, phone, bankName, bankAccount, isDefault } = body as {
      name: string; taxId?: string; address?: string; phone?: string;
      bankName?: string; bankAccount?: string; isDefault?: boolean;
    };

    if (!name) return error("公司名称为必填项");

    // If this is the first company, make it default
    const count = await prisma.company.count();
    const makeDefault = isDefault || count === 0;

    if (makeDefault) {
      await prisma.company.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }

    const company = await prisma.company.create({
      data: { name, taxId, address, phone, bankName, bankAccount, isDefault: makeDefault },
    });
    return success(company, 201);
  } catch (e: any) {
    if (e?.code === "P2002") return error("公司名称已存在");
    return error(e instanceof Error ? e.message : "创建公司失败");
  }
}
