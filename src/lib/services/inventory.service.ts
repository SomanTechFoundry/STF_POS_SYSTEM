import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const INVENTORY_LOCATION_CODES = {
  MAIN_STORE: "main_store",
  GODOWN: "godown",
} as const;

type Db = PrismaClient | Prisma.TransactionClient;

export async function getLocationMap(db: Db, businessId: string) {
  const defaults = [
    { code: INVENTORY_LOCATION_CODES.MAIN_STORE, name: "Main Store" },
    { code: INVENTORY_LOCATION_CODES.GODOWN, name: "Godown" },
  ];

  for (const loc of defaults) {
    await db.inventoryLocation.upsert({
      where: { businessId_code: { businessId, code: loc.code } },
      create: { businessId, code: loc.code, name: loc.name },
      update: {},
    });
  }

  const rows = await db.inventoryLocation.findMany({ where: { businessId } });
  return new Map(rows.map((r) => [r.code, r]));
}

export async function syncVariantStockQty(db: Db, variantId: string) {
  const agg = await db.inventoryStock.aggregate({
    where: { variantId },
    _sum: { qty: true },
  });
  await db.productVariant.update({
    where: { id: variantId },
    data: { stockQty: agg._sum.qty ?? 0 },
  });
}

export { prisma };
