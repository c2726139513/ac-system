import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, error, getBody, requireCompanyId, requirePermission } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const perm = await requirePermission(request, "projects");
    if (perm) return perm;
    const companyId = requireCompanyId(request);
    const projects = await prisma.project.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            purchasePackages: true,
          },
        },
      },
    });
    return success(projects);
  } catch (e) {
    return error(e instanceof Error ? e.message : "获取项目列表失败");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await getBody(request);
    const { name, code, description } = body as {
      name: string;
      code: string;
      description?: string;
    };
    const companyId = requireCompanyId(request);

    if (!name || !code) {
      return error("项目名称和编码不能为空");
    }

    const existing = await prisma.project.findUnique({ where: { code } });
    if (existing) {
      return error("项目编码已存在");
    }

    const project = await prisma.project.create({
      data: { name, code, description, companyId },
    });
    return success(project, 201);
  } catch (e) {
    return error(e instanceof Error ? e.message : "创建项目失败");
  }
}
