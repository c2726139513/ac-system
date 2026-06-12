import "dotenv/config";
import { PrismaClient } from "./src/generated/prisma/client";

const url = process.env.DATABASE_URL!;
const prisma = new PrismaClient();

async function main() {
  const roles = await prisma.role.findMany();
  console.log("=== Roles ===");
  for (const r of roles) {
    console.log(JSON.stringify(r, null, 2));
  }

  const users = await prisma.user.findMany({ include: { role: true } });
  console.log("\n=== Users ===");
  for (const u of users) {
    console.log({ id: u.id, username: u.username, name: u.name, active: u.active, role: u.role?.name, permissions: u.role?.permissions });
  }

  const companies = await prisma.company.findMany();
  console.log("\n=== Companies ===");
  for (const c of companies) {
    console.log(JSON.stringify(c, null, 2));
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
