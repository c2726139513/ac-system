import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, error, getBody, requireCompanyId, requirePermission } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const perm = await requirePermission(request, "sales-contracts");
    if (perm) return perm;
    const { id } = await params;
    const companyId = requireCompanyId(request);
    const contract = await prisma.salesContract.findFirst({
      where: { id, companyId },
      include: {
        purchasePackage: {
          select: { id: true, name: true, code: true, project: { select: { id: true, name: true } } },
        },
        customer: { select: { id: true, name: true, contactPerson: true, phone: true } },
        receipts: { orderBy: { receiptDate: "desc" } },
        invoices: { orderBy: { invoiceDate: "desc" } },
      },
    });

    if (!contract) return error("销售合同不存在", 404);

    const totalReceived = contract.receipts.reduce(
      (sum, r) => sum + Number(r.amount), 0
    );
    const totalInvoiced = contract.invoices.reduce(
      (sum, i) => sum + Number(i.totalAmount), 0
    );

    return success({
      ...contract,
      totalReceived,
      totalInvoiced,
      amount: Number(contract.amount),
    });
  } catch (e) {
    return error(e instanceof Error ? e.message : "获取销售合同详情失败");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const perm = await requirePermission(request, "sales-contracts");
    if (perm) return perm;
    const { id } = await params;
    const companyId = requireCompanyId(request);
    const body = await getBody(request);
    const { contractNo, contractName, customerName, customerId, amount, signedDate, status, description } = body as any;

    const existing = await prisma.salesContract.findFirst({ where: { id, companyId } });
    if (!existing) return error("销售合同不存在", 404);

    if (contractNo && contractNo !== existing.contractNo) {
      const purchaseWithSameNo = await prisma.purchaseContract.findUnique({ where: { contractNo }, select: { id: true } });
      if (purchaseWithSameNo) return error("合同编号已被采购合同使用");
    }

    let finalCustomerName = customerName;
    if (customerId !== undefined) {
      if (customerId) {
        const partner = await prisma.partner.findUnique({ where: { id: customerId } });
        if (partner) finalCustomerName = partner.name;
      }
    }

    const contract = await prisma.salesContract.update({
      where: { id },
      data: {
        ...(contractNo !== undefined && { contractNo }),
        ...(contractName !== undefined && { contractName }),
        ...(customerId !== undefined && { customerId: customerId || null }),
        ...(customerName !== undefined && { customerName: finalCustomerName }),
        ...(amount !== undefined && { amount }),
        ...(signedDate !== undefined && { signedDate: signedDate ? new Date(signedDate) : null }),
        ...(status !== undefined && { status }),
        ...(description !== undefined && { description }),
      },
      include: {
        purchasePackage: {
          select: { id: true, name: true, code: true, project: { select: { id: true, name: true } } },
        },
        customer: { select: { id: true, name: true } },
      },
    });
    return success(contract);
  } catch (e) {
    return error(e instanceof Error ? e.message : "更新销售合同失败");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const perm = await requirePermission(request, "sales-contracts");
    if (perm) return perm;
    const { id } = await params;
    const companyId = requireCompanyId(request);
    const existing = await prisma.salesContract.findFirst({ where: { id, companyId } });
    if (!existing) return error("销售合同不存在", 404);
    await prisma.salesContract.delete({ where: { id } });
    return success({ deleted: true });
  } catch (e) {
    return error(e instanceof Error ? e.message : "删除销售合同失败");
  }
}
