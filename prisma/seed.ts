import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PRINT_TEMPLATES = [
  {
    templateKey: "classic_invoice",
    name: "Classic Invoice",
    description: "Traditional invoice format with ruled rows and terms footer.",
  },
  {
    templateKey: "modern_invoice",
    name: "Modern Invoice",
    description: "Clean modern bill layout for A4 print.",
  },
  {
    templateKey: "thermal_80mm",
    name: "Thermal 80mm",
    description: "Compact receipt style for thermal printers.",
  },
] as const;

async function main() {
  for (const template of PRINT_TEMPLATES) {
    await prisma.printTemplate.upsert({
      where: { templateKey: template.templateKey },
      create: { ...template, isActive: true },
      update: {
        name: template.name,
        description: template.description,
        isActive: true,
      },
    });
  }

  const email = (process.env.SEED_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "admin@example.com")
    .trim()
    .toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || "Admin123!";
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.appUser.upsert({
    where: { email },
    create: {
      businessName: "STF Demo Store",
      businessProfileId: "fertilizer",
      fullName: "STF Admin",
      email,
      passwordHash,
      role: "admin",
      isActive: true,
    },
    update: {
      passwordHash,
      role: "admin",
      isActive: true,
    },
  });

  // Ensure default inventory locations for the seeded business
  for (const loc of [
    { code: "main_store", name: "Main Store" },
    { code: "godown", name: "Godown" },
  ]) {
    await prisma.inventoryLocation.upsert({
      where: {
        businessId_code: { businessId: user.businessId, code: loc.code },
      },
      create: { businessId: user.businessId, code: loc.code, name: loc.name },
      update: {},
    });
  }

  console.log("Seed complete");
  console.log(`  Print templates: ${PRINT_TEMPLATES.length}`);
  console.log(`  Admin login: ${email}`);
  console.log(`  Admin password: ${password}`);
  console.log(`  Business id: ${user.businessId}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
