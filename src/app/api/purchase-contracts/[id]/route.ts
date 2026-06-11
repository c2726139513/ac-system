import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, error, getBody, requireCompanyId, requirePermission } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const perm = await requirePermission(request, "purchase-contracts");
    if (perm) return perm;
    const { id } = await params;
    const companyId = requireCompanyId(request);
    const contract = await prisma.purchaseContract.findFirst({
      where: { id, companyId },
      include: {
        purchasePackage: {
          select: { id: true, name: true, code: true, project: { select: { id: true, name: true } } },
        },
        supplier: { select: { id: true, name: true, contactPerson: true, phone: true } },
        payments: { orderBy: { paymentDate: "desc" } },
        invoices: { orderBy: { invoiceDate: "desc" } },
      },
    });

    if (!contract) return error("采购合同不存在", 404);

    const totalPaid = contract.payments.reduce(
      (sum, p) => sum + Number(p.amount), 0
    );
    const totalInvoiced = contract.invoices.reduce(
      (sum, i) => sum + Number(i.totalAmount), 0
    );

    return success({
      ...contract,
      totalPaid,
      totalInvoiced,
      amount: Number(contract.amount),
    });
  } catch (e) {
    return error(e instanceof Error ? e.message : "获取采购合同详情失败");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const perm = await requirePermission(request, "purchase-contracts");
    if (perm) return perm;
    const { id } = await params;
    const companyId = requireCompanyId(request);
    const body = await getBody(request);
    const { contractNo, contractName, supplierName, supplierId, amount, signedDate, status, description } = body as any;

    const existing = await prisma.purchaseContract.findFirst({ where: { id, companyId } });
    if (!existing) return error("采购合同不存在", 404);

    if (contractNo && contractNo !== existing.contractNo) {
      const salesWithSameNo = await prisma.salesContract.findUnique({ where: { contractNo }, select: { id: true } });
      if (salesWithSameNo) return error("合同编号已被销售合同使用");
    }

    let finalSupplierName = supplierName;
    if (supplierId !== undefined) {
      if (supplierId) {
        const partner = await prisma.partner.findUnique({ where: { id: supplierId } });
        if (partner) finalSupplierName = partner.name;
      }
    }

    const contract = await prisma.purchaseContract.update({
      where: { id },
      data: {
        ...(contractNo !== undefined && { contractNo }),
        ...(contractName !== undefined && { contractName }),
        ...(supplierId !== undefined && { supplierId: supplierId || null }),
        ...(supplierName !== undefined && { supplierName: finalSupplierName }),
        ...(amount !== undefined && { amount }),
        ...(signedDate !== undefined && { signedDate: signedDate ? new Date(signedDate) : null }),
        ...(status !== undefined && { status }),
        ...(description !== undefined && { description }),
      },
      include: {
        purchasePackage: {
          select: { id: true, name: true, code: true, project: { select: { id: true, name: true } } },
        },
        supplier: { select: { id: true, name: true } },
      },
    });
    return success(contract);
  } catch (e) {
    return error(e instanceof Error ? e.message : "更新采购合同失败");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const perm = await requirePermission(request, "purchase-contracts");
    if (perm) return perm;
    const { id } = await params;
    const companyId = requireCompanyId(request);
    const existing = await prisma.purchaseContract.findFirst({ where: { id, companyId } });
    if (!existing) return error("采购合同不存在", 404);
    await prisma.purchaseContract.delete({ where: { id } });
    return success({ deleted: true });
  } catch (e) {
    return error(e instanceof Error ? e.message : "删除采购合同失败");
  }
}
