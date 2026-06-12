import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, error, getBody, requireCompanyId, requirePermission } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const perm = await requirePermission(request, "purchase-packages");
    if (perm) return perm;
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const companyId = requireCompanyId(request);

    const where: any = { companyId };
    if (projectId) where.projectId = projectId;
    const packages = await prisma.purchasePackage.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, code: true } },
        _count: { select: { purchaseContracts: true, salesContracts: true } },
      },
    });
    // 按编码排序：字母前缀升序 → 主数字升序 → 副数字升序
    const codePattern = /^([A-Za-z]+)(\d+)(?:-(\d+))?$/;
    packages.sort((a, b) => {
      const ma = a.code.match(codePattern);
      const mb = b.code.match(codePattern);
      if (!ma || !mb) return a.code.localeCompare(b.code);
      const letterCmp = ma[1].localeCompare(mb[1]);
      if (letterCmp !== 0) return letterCmp;
      const mainCmp = parseInt(ma[2], 10) - parseInt(mb[2], 10);
      if (mainCmp !== 0) return mainCmp;
      const subA = ma[3] !== undefined ? parseInt(ma[3], 10) : -1;
      const subB = mb[3] !== undefined ? parseInt(mb[3], 10) : -1;
      return subA - subB;
    });
    return success(packages);
  } catch (e) {
    return error(e instanceof Error ? e.message : "获取采购包列表失败");
  }
}

export async function POST(request: NextRequest) {
  try {
    const perm = await requirePermission(request, "purchase-packages");
    if (perm) return perm;
    const body = await getBody(request);
    const { projectId, name, code, description, amount } = body as {
      projectId: string;
      name: string;
      code: string;
      description?: string;
      amount?: number;
    };
    const companyId = requireCompanyId(request);

    if (!projectId || !name || !code) {
      return error("项目ID、采购包名称、采购包编码为必填项");
    }

    const pkg = await prisma.purchasePackage.create({
      data: {
        projectId,
        companyId,
        name,
        code,
        description,
        amount: amount || 0,
      },
      include: {
        project: { select: { id: true, name: true, code: true } },
      },
    });
    return success(pkg, 201);
  } catch (e: any) {
    if (e?.code === "P2002") return error("该项目下采购包编码已存在");
    return error(e instanceof Error ? e.message : "创建采购包失败");
  }
}
