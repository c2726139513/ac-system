import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, error, getBody, requirePermission } from "@/lib/api-utils";

const PERMISSION_LABELS: Record<string, string> = {
  projects: "项目管理",
  "purchase-packages": "采购包管理",
  "purchase-contracts": "采购合同",
  "sales-contracts": "销售合同",
  payments: "付款记录",
  receipts: "收款记录",
  invoices: "发票管理",
  users: "用户管理",
  partners: "伙伴管理",
  companies: "公司管理",
};

export async function GET(request: NextRequest) {
  try {
    const perm = await requirePermission(request, "users");
    if (perm) return perm;
    const roles = await prisma.role.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { users: true } } },
    });
    const parsePerms = (val: string | null): string[] => {
      if (!val) return [];
      try { return JSON.parse(val); } catch { return []; }
    };
    const result = roles.map((r) => {
      const perms = parsePerms(r.permissions);
      return {
        id: r.id,
        name: r.name,
        description: r.description,
        permissions: perms,
        permissionLabels: perms.map((p: string) => PERMISSION_LABELS[p] || p),
        userCount: r._count.users,
      };
    });
    return success(result);
  } catch (e) {
    return error(e instanceof Error ? e.message : "获取角色列表失败");
  }
}

export async function POST(request: NextRequest) {
  try {
    const perm = await requirePermission(request, "users");
    if (perm) return perm;
    const body = await getBody(request);
    const { name, description, permissions } = body as {
      name: string;
      description?: string;
      permissions: string[];
    };

    if (!name) return error("角色名称为必填项");

    const role = await prisma.role.create({
      data: {
        name,
        description,
        permissions: JSON.stringify(permissions || []),
      },
    });

    return success({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions ? JSON.parse(role.permissions) : [],
    }, 201);
  } catch (e: any) {
    if (e?.code === "P2002") return error("角色名称已存在");
    return error(e instanceof Error ? e.message : "创建角色失败");
  }
}
