import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, error, getBody, requireCompanyId, requirePermission } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const perm = await requirePermission(request, "sales-contracts");
    if (perm) return perm;
    const { searchParams } = new URL(request.url);
    const purchasePackageId = searchParams.get("purchasePackageId");
    const search = searchParams.get("search");
    const companyId = requireCompanyId(request);

    const where: any = { companyId };
    if (purchasePackageId) where.purchasePackageId = purchasePackageId;
    if (search) {
      where.OR = [
        { contractNo: { contains: search } },
        { contractName: { contains: search } },
        { customerName: { contains: search } },
        { purchasePackage: { name: { contains: search } } },
        { purchasePackage: { code: { contains: search } } },
        { purchasePackage: { project: { name: { contains: search } } } },
      ];
    }

    const contracts = await prisma.salesContract.findMany({
      where,
      include: {
        purchasePackage: {
          select: { id: true, name: true, code: true, project: { select: { id: true, name: true } } },
        },
        customer: { select: { id: true, name: true } },
        _count: { select: { receipts: true, invoices: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return success(contracts);
  } catch (e) {
    return error(e instanceof Error ? e.message : "获取销售合同列表失败");
  }
}

export async function POST(request: NextRequest) {
  try {
    const perm = await requirePermission(request, "sales-contracts");
    if (perm) return perm;
    const body = await getBody(request);
    const { purchasePackageId, contractNo, contractName, customerName, customerId, amount, signedDate, status, description } = body as {
      purchasePackageId: string;
      contractNo: string;
      contractName: string;
      customerName?: string;
      customerId?: string;
      amount: number;
      signedDate?: string;
      status?: string;
      description?: string;
    };
    const companyId = requireCompanyId(request);

    if (!purchasePackageId || !contractNo || !contractName || amount === undefined) {
      return error("采购包ID、合同编号、合同名称、金额为必填项");
    }

    const purchaseWithSameNo = await prisma.purchaseContract.findUnique({ where: { contractNo }, select: { id: true } });
    if (purchaseWithSameNo) return error("合同编号已被采购合同使用");

    let finalCustomerName = customerName;
    if (customerId) {
      const partner = await prisma.partner.findUnique({ where: { id: customerId } });
      if (partner) finalCustomerName = partner.name;
    }

    const contract = await prisma.salesContract.create({
      data: {
        purchasePackageId,
        companyId,
        contractNo,
        contractName,
        customerId: customerId || null,
        customerName: finalCustomerName,
        amount,
        signedDate: signedDate ? new Date(signedDate) : null,
        status: (status as any) || "DRAFT",
        description,
      },
      include: {
        purchasePackage: {
          select: { id: true, name: true, code: true, project: { select: { id: true, name: true } } },
        },
        customer: { select: { id: true, name: true } },
      },
    });
    return success(contract, 201);
  } catch (e: any) {
    if (e?.code === "P2002") return error("该采购包下合同编号已存在");
    return error(e instanceof Error ? e.message : "创建销售合同失败");
  }
}
