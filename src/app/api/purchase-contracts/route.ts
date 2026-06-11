import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { success, error, getBody, requireCompanyId, requirePermission } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const perm = await requirePermission(request, "purchase-contracts");
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
        { supplierName: { contains: search } },
        { purchasePackage: { name: { contains: search } } },
        { purchasePackage: { code: { contains: search } } },
        { purchasePackage: { project: { name: { contains: search } } } },
      ];
    }

    const contracts = await prisma.purchaseContract.findMany({
      where,
      include: {
        purchasePackage: {
          select: { id: true, name: true, code: true, project: { select: { id: true, name: true } } },
        },
        supplier: { select: { id: true, name: true } },
        _count: { select: { payments: true, invoices: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return success(contracts);
  } catch (e) {
    return error(e instanceof Error ? e.message : "获取采购合同列表失败");
  }
}

export async function POST(request: NextRequest) {
  try {
    const perm = await requirePermission(request, "purchase-contracts");
    if (perm) return perm;
    const body = await getBody(request);
    const { purchasePackageId, contractNo, contractName, supplierName, supplierId, amount, signedDate, status, description } = body as {
      purchasePackageId: string;
      contractNo: string;
      contractName: string;
      supplierName?: string;
      supplierId?: string;
      amount: number;
      signedDate?: string;
      status?: string;
      description?: string;
    };
    const companyId = requireCompanyId(request);

    if (!purchasePackageId || !contractNo || !contractName || amount === undefined) {
      return error("采购包ID、合同编号、合同名称、金额为必填项");
    }

    const salesWithSameNo = await prisma.salesContract.findUnique({ where: { contractNo }, select: { id: true } });
    if (salesWithSameNo) return error("合同编号已被销售合同使用");

    // If supplierId provided, look up partner name
    let finalSupplierName = supplierName;
    if (supplierId) {
      const partner = await prisma.partner.findUnique({ where: { id: supplierId } });
      if (partner) finalSupplierName = partner.name;
    }

    const contract = await prisma.purchaseContract.create({
      data: {
        purchasePackageId,
        companyId,
        contractNo,
        contractName,
        supplierId: supplierId || null,
        supplierName: finalSupplierName,
        amount,
        signedDate: signedDate ? new Date(signedDate) : null,
        status: (status as any) || "DRAFT",
        description,
      },
      include: {
        purchasePackage: {
          select: { id: true, name: true, code: true, project: { select: { id: true, name: true } } },
        },
        supplier: { select: { id: true, name: true } },
      },
    });
    return success(contract, 201);
  } catch (e: any) {
    if (e?.code === "P2002") return error("该采购包下合同编号已存在");
    return error(e instanceof Error ? e.message : "创建采购合同失败");
  }
}
