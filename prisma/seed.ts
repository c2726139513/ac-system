import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create admin role
  const adminRole = await prisma.role.upsert({
    where: { name: "admin" },
    update: {},
    create: {
      name: "admin",
      description: "系统管理员",
      permissions: "all",
    },
  });
  console.log(`✓ Role created: ${adminRole.name} (${adminRole.id})`);

  // Create default admin user (password: admin123)
  const bcrypt = await import("bcryptjs");
  const hashedPassword = await bcrypt.hash("admin123", 10);

  const adminUser = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      password: hashedPassword,
      name: "系统管理员",
      roleId: adminRole.id,
      active: true,
    },
  });
  console.log(`✓ User created: ${adminUser.username} (${adminUser.name})`);

  console.log("\nSeeding complete!");
  console.log("Default login: admin / admin123");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
