import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, error, getBody, requirePermission } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const perm = await requirePermission(request, "partners");
    if (perm) return perm;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const search = searchParams.get("search");

    const where: any = {};
    if (type && (type === "SUPPLIER" || type === "CUSTOMER" || type === "BOTH")) {
      where.OR = [{ type }, { type: "BOTH" }];
    }
    if (search) {
      const nameCond = {
        OR: [
          { name: { contains: search } },
          { contactPerson: { contains: search } },
          { phone: { contains: search } },
        ],
      };
      where.AND = where.OR
        ? [{ OR: where.OR }, nameCond]
        : [nameCond];
      delete where.OR;
    }

    const partners = await prisma.partner.findMany({
      where,
      orderBy: { name: "asc" },
    });
    return success(partners);
  } catch (e) {
    return error(e instanceof Error ? e.message : "获取伙伴列表失败");
  }
}

export async function POST(request: NextRequest) {
  try {
    const perm = await requirePermission(request, "partners");
    if (perm) return perm;
    const body = await getBody(request);
    const { name, type, contactPerson, phone, email, address, notes } = body as any;

    if (!name || !type) return error("名称和类型为必填项");

    const partner = await prisma.partner.create({
      data: { name, type, contactPerson, phone, email, address, notes },
    });
    return success(partner, 201);
  } catch (e: any) {
    if (e?.code === "P2002") return error("伙伴名称已存在");
    return error(e instanceof Error ? e.message : "创建伙伴失败");
  }
}
