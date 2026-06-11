import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, error, getBody, requireCompanyId, requirePermission } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    { const perm = await requirePermission(request, "projects"); if (perm) return perm; }
    const { id } = await params;
    const companyId = requireCompanyId(request);
    const project = await prisma.project.findFirst({
      where: { id, companyId },
      include: {
        purchasePackages: {
          include: {
            purchaseContracts: {
              include: {
                supplier: { select: { id: true, name: true } },
                payments: { select: { amount: true } },
                invoices: { select: { totalAmount: true } },
              },
              orderBy: { createdAt: "desc" },
            },
            salesContracts: {
              include: {
                customer: { select: { id: true, name: true } },
                receipts: { select: { amount: true } },
                invoices: { select: { totalAmount: true } },
              },
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!project) {
      return error("项目不存在", 404);
    }

    const result = {
      ...project,
      purchasePackages: project.purchasePackages.map((pkg) => ({
        ...pkg,
        amount: Number(pkg.amount),
        purchaseContracts: pkg.purchaseContracts.map((c) => {
          const totalPaid = c.payments.reduce((s, p) => s + Number(p.amount), 0);
          const totalInvoiced = c.invoices.reduce((s, i) => s + Number(i.totalAmount), 0);
          const { payments, invoices, ...rest } = c;
          return { ...rest, totalPaid, totalInvoiced, amount: Number(c.amount) };
        }),
        salesContracts: pkg.salesContracts.map((c) => {
          const totalReceived = c.receipts.reduce((s, r) => s + Number(r.amount), 0);
          const totalInvoiced = c.invoices.reduce((s, i) => s + Number(i.totalAmount), 0);
          const { receipts, invoices, ...rest } = c;
          return { ...rest, totalReceived, totalInvoiced, amount: Number(c.amount) };
        }),
      })),
    };
    return success(result);
  } catch (e) {
    return error(e instanceof Error ? e.message : "获取项目详情失败");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    { const perm = await requirePermission(request, "projects"); if (perm) return perm; }
    const { id } = await params;
    const body = await getBody(request);
    const { name, code, description, status } = body as {
      name?: string;
      code?: string;
      description?: string;
      status?: string;
    };

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      return error("项目不存在", 404);
    }

    if (code && code !== existing.code) {
      const dup = await prisma.project.findUnique({ where: { code } });
      if (dup) return error("项目编码已存在");
    }

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status: status as any }),
      },
    });
    return success(project);
  } catch (e) {
    return error(e instanceof Error ? e.message : "更新项目失败");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    { const perm = await requirePermission(request, "projects"); if (perm) return perm; }
    const { id } = await params;
    await prisma.project.delete({ where: { id } });
    return success({ deleted: true });
  } catch (e) {
    return error(e instanceof Error ? e.message : "删除项目失败");
  }
}
