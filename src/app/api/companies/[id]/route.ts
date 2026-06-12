import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, error, getBody, requirePermission } from "@/lib/api-utils";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const perm = await requirePermission(request, "companies");
    if (perm) return perm;
    const { id } = await params;
    const body = await getBody(request);
    const { name, taxId, address, phone, bankName, bankAccount, isDefault, active } = body as {
      name?: string; taxId?: string; address?: string; phone?: string;
      bankName?: string; bankAccount?: string; isDefault?: boolean; active?: boolean;
    };

    if (isDefault) {
      await prisma.company.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }

    const company = await prisma.company.update({
      where: { id },
      data: { ...(name !== undefined && { name }), ...(taxId !== undefined && { taxId }), ...(address !== undefined && { address }), ...(phone !== undefined && { phone }), ...(bankName !== undefined && { bankName }), ...(bankAccount !== undefined && { bankAccount }), ...(isDefault !== undefined && { isDefault }), ...(active !== undefined && { active }) },
    });
    return success(company);
  } catch (e) {
    return error(e instanceof Error ? e.message : "更新公司失败");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const perm = await requirePermission(request, "companies");
    if (perm) return perm;
    const { id } = await params;
    await prisma.company.update({ where: { id }, data: { active: false } });
    return success({ deleted: true });
  } catch (e) {
    return error(e instanceof Error ? e.message : "删除公司失败");
  }
}
