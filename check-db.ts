import "dotenv/config";
import { PrismaClient } from "./src/generated/prisma/client";

const url = process.env.DATABASE_URL!;
console.log("DB URL:", url.replace(/:[^:@]+@/, ":****@"));
const prisma = new PrismaClient();

async function main() {
  const tables = ["User", "Company", "Project", "Partner", "Role", "PurchasePackage", "PurchaseContract", "SalesContract", "Payment", "Receipt", "PurchaseInvoice", "SalesInvoice", "SequenceCounter"] as const;
  for (const t of tables) {
    try {
      const count = await (prisma as any)[t].count();
      console.log(`${t}: ${count} rows`);
    } catch (e: any) {
      console.log(`${t}: ERROR - ${e.message.substring(0, 100)}`);
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
