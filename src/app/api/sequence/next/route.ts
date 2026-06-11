import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { nextSequence } from "@/lib/sequence";
import { success, error } from "@/lib/api-utils";

const entityConfig: Record<string, { findMany: (prefix: string) => Promise<string[]> }> = {
  payment: {
    findMany: async (prefix) => {
      const rows = await prisma.payment.findMany({ where: { paymentNo: { startsWith: prefix } }, select: { paymentNo: true } });
      return rows.map((r) => r.paymentNo!).filter(Boolean);
    },
  },
  receipt: {
    findMany: async (prefix) => {
      const rows = await prisma.receipt.findMany({ where: { receiptNo: { startsWith: prefix } }, select: { receiptNo: true } });
      return rows.map((r) => r.receiptNo!).filter(Boolean);
    },
  },
  "purchase-invoice": {
    findMany: async (prefix) => {
      const rows = await prisma.purchaseInvoice.findMany({ where: { invoiceNo: { startsWith: prefix } }, select: { invoiceNo: true } });
      return rows.map((r) => r.invoiceNo);
    },
  },
  "sales-invoice": {
    findMany: async (prefix) => {
      const rows = await prisma.salesInvoice.findMany({ where: { invoiceNo: { startsWith: prefix } }, select: { invoiceNo: true } });
      return rows.map((r) => r.invoiceNo);
    },
  },
  "purchase-contract": {
    findMany: async (prefix) => {
      const rows = await prisma.purchaseContract.findMany({ where: { contractNo: { startsWith: prefix } }, select: { contractNo: true } });
      return rows.map((r) => r.contractNo);
    },
  },
  "sales-contract": {
    findMany: async (prefix) => {
      const rows = await prisma.salesContract.findMany({ where: { contractNo: { startsWith: prefix } }, select: { contractNo: true } });
      return rows.map((r) => r.contractNo);
    },
  },
  // Unified entity: checks both purchase and sales contracts for unique numbering
  contract: {
    findMany: async (prefix) => {
      const [pRows, sRows] = await Promise.all([
        prisma.purchaseContract.findMany({ where: { contractNo: { startsWith: prefix } }, select: { contractNo: true } }),
        prisma.salesContract.findMany({ where: { contractNo: { startsWith: prefix } }, select: { contractNo: true } }),
      ]);
      return [...pRows.map((r) => r.contractNo), ...sRows.map((r) => r.contractNo)];
    },
  },
  transaction: {
    findMany: async (prefix) => {
      const [pRows, rRows] = await Promise.all([
        prisma.payment.findMany({ where: { paymentNo: { startsWith: prefix } }, select: { paymentNo: true } }),
        prisma.receipt.findMany({ where: { receiptNo: { startsWith: prefix } }, select: { receiptNo: true } }),
      ]);
      return [...pRows.map((r) => r.paymentNo!).filter(Boolean), ...rRows.map((r) => r.receiptNo!).filter(Boolean)];
    },
  },
  invoice: {
    findMany: async (prefix) => {
      const [pRows, sRows] = await Promise.all([
        prisma.purchaseInvoice.findMany({ where: { invoiceNo: { startsWith: prefix } }, select: { invoiceNo: true } }),
        prisma.salesInvoice.findMany({ where: { invoiceNo: { startsWith: prefix } }, select: { invoiceNo: true } }),
      ]);
      return [...pRows.map((r) => r.invoiceNo), ...sRows.map((r) => r.invoiceNo)];
    },
  },
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entity = searchParams.get("entity");
    if (!entity) return error("缺少 entity 参数");

    const now = new Date();
    const ym = now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, "0");

    const config = entityConfig[entity];
    if (config) {
      const existing = await config.findMany(ym);
      const seq = await nextSequence(entity, existing);
      return success({ seq });
    }

    const seq = await nextSequence(entity);
    return success({ seq });
  } catch (e) {
    return error(e instanceof Error ? e.message : "获取编号失败");
  }
}
