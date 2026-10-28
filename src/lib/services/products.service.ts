import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/errors";
import { getLocationMap, syncVariantStockQty } from "@/lib/services/inventory.service";
import { resolveEntityTranslations, upsertEntityTranslations } from "@/lib/services/i18n.service";

export type ProductVariantInput = {
  id?: string;
  sku: string;
  unitType: string;
  unitSize: number;
  costPrice: number;
  salePrice: number;
  stockQty: number;
  reorderLevel: number;
};

export type ProductPayload = {
  name: string;
  category: string;
  variants: ProductVariantInput[];
};

type Db = Prisma.TransactionClient;

function toNum(value: unknown): number {
  return Number(value ?? 0);
}

function mapVariant(
  variant: {
    id: string;
    sku: string;
    unitType: string;
    unitSize: unknown;
    costPrice: unknown;
    salePrice: unknown;
    stockQty: number;
    reorderLevel: number;
    createdAt: Date;
    stocks: Array<{ qty: number; locationId: string }>;
  },
  locations: Array<{ id: string; code: string; name: string }>,
) {
  return {
    id: variant.id,
    sku: variant.sku,
    unit_type: variant.unitType,
    unit_size: toNum(variant.unitSize),
    cost_price: toNum(variant.costPrice),
    sale_price: toNum(variant.salePrice),
    stock_qty: variant.stockQty,
    reorder_level: variant.reorderLevel,
    created_at: variant.createdAt,
    location_stocks: locations.map((loc) => {
      const stock = variant.stocks.find((s) => s.locationId === loc.id);
      return {
        location_code: loc.code,
        location_name: loc.name,
        qty: stock?.qty ?? 0,
      };
    }),
  };
}

async function loadProducts(businessId: string, locale: string, active: boolean) {
  const [products, locations] = await Promise.all([
    prisma.product.findMany({
      where: { businessId, isActive: active },
      include: {
        variants: {
          where: active ? { isActive: true } : undefined,
          include: { stocks: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.inventoryLocation.findMany({
      where: { businessId },
      orderBy: { code: "asc" },
    }),
  ]);

  const mapped = products.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    created_at: product.createdAt,
    variants: product.variants.map((variant) => mapVariant(variant, locations)),
  }));

  const translations = await resolveEntityTranslations(
    null,
    businessId,
    "product",
    mapped.map((p) => p.id),
    ["name", "category"],
    locale,
  );

  return mapped.map((product) => {
    const translated = translations.get(product.id) || {};
    return {
      ...product,
      name: translated.name || product.name,
      category: translated.category || product.category,
    };
  });
}

export async function listProducts(businessId: string, locale: string) {
  return loadProducts(businessId, locale, true);
}

export async function listArchivedProducts(businessId: string, locale: string) {
  return loadProducts(businessId, locale, false);
}

async function upsertVariants(tx: Db, businessId: string, productId: string, variants: ProductVariantInput[]) {
  const locations = await getLocationMap(tx, businessId);
  const mainStore = locations.get("main_store");
  const godown = locations.get("godown");

  if (!mainStore || !godown) {
    throw new ApiError(500, "Inventory locations are not configured");
  }

  const existing = await tx.productVariant.findMany({
    where: { productId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((row) => row.id));
  const incomingIds = new Set(variants.map((variant) => variant.id).filter(Boolean) as string[]);

  for (const existingId of existingIds) {
    if (!incomingIds.has(existingId)) {
      await tx.productVariant.update({
        where: { id: existingId },
        data: { isActive: false },
      });
    }
  }

  for (const variant of variants) {
    if (variant.id) {
      await tx.productVariant.updateMany({
        where: { id: variant.id, productId },
        data: {
          sku: variant.sku,
          unitType: variant.unitType,
          unitSize: variant.unitSize,
          costPrice: variant.costPrice,
          salePrice: variant.salePrice,
          stockQty: variant.stockQty,
          reorderLevel: variant.reorderLevel,
          isActive: true,
        },
      });

      const stockAgg = await tx.inventoryStock.aggregate({
        where: { variantId: variant.id },
        _sum: { qty: true },
      });
      const currentTotal = Number(stockAgg._sum.qty || 0);
      const targetTotal = Number(variant.stockQty);
      const delta = targetTotal - currentTotal;

      await tx.inventoryStock.upsert({
        where: {
          variantId_locationId: { variantId: variant.id, locationId: mainStore.id },
        },
        create: { businessId, variantId: variant.id, locationId: mainStore.id, qty: 0 },
        update: {},
      });
      await tx.inventoryStock.upsert({
        where: {
          variantId_locationId: { variantId: variant.id, locationId: godown.id },
        },
        create: { businessId, variantId: variant.id, locationId: godown.id, qty: 0 },
        update: {},
      });

      if (delta !== 0) {
        const adjust = await tx.inventoryStock.updateMany({
          where: {
            variantId: variant.id,
            locationId: mainStore.id,
            ...(delta < 0 ? { qty: { gte: -delta } } : {}),
          },
          data: { qty: { increment: delta } },
        });

        if (adjust.count === 0) {
          throw new ApiError(400, "Cannot reduce below available stock in Main Store");
        }
      }

      await syncVariantStockQty(tx, variant.id);
    } else {
      const created = await tx.productVariant.create({
        data: {
          productId,
          businessId,
          sku: variant.sku,
          unitType: variant.unitType,
          unitSize: variant.unitSize,
          costPrice: variant.costPrice,
          salePrice: variant.salePrice,
          stockQty: variant.stockQty,
          reorderLevel: variant.reorderLevel,
          isActive: true,
        },
      });

      await tx.inventoryStock.createMany({
        data: [
          {
            businessId,
            variantId: created.id,
            locationId: mainStore.id,
            qty: variant.stockQty,
          },
          {
            businessId,
            variantId: created.id,
            locationId: godown.id,
            qty: 0,
          },
        ],
        skipDuplicates: true,
      });
    }
  }
}

export async function createProduct(businessId: string, payload: ProductPayload, locale: string) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        businessId,
        name: payload.name,
        category: payload.category,
        isActive: true,
      },
    });

    await upsertEntityTranslations(tx, businessId, "product", product.id, locale, {
      name: payload.name,
      category: payload.category,
    });
    await upsertVariants(tx, businessId, product.id, payload.variants);

    return { id: product.id };
  });
}

export async function updateProduct(
  businessId: string,
  productId: string,
  payload: ProductPayload,
  locale: string,
) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.product.updateMany({
      where: { id: productId, businessId, isActive: true },
      data: {
        name: payload.name,
        category: payload.category,
      },
    });

    if (result.count === 0) {
      throw new ApiError(404, "Product not found");
    }

    await upsertEntityTranslations(tx, businessId, "product", productId, locale, {
      name: payload.name,
      category: payload.category,
    });
    await upsertVariants(tx, businessId, productId, payload.variants);

    return { id: productId };
  });
}

export async function archiveProduct(businessId: string, productId: string) {
  const result = await prisma.product.updateMany({
    where: { id: productId, businessId, isActive: true },
    data: { isActive: false },
  });

  if (result.count === 0) {
    throw new ApiError(404, "Product not found");
  }

  await prisma.productVariant.updateMany({
    where: { productId },
    data: { isActive: false },
  });

  return { id: productId, archived: true };
}

export async function restoreProduct(businessId: string, productId: string) {
  try {
    const result = await prisma.product.updateMany({
      where: { id: productId, businessId, isActive: false },
      data: { isActive: true },
    });

    if (result.count === 0) {
      throw new ApiError(404, "Archived product not found");
    }

    await prisma.productVariant.updateMany({
      where: { productId },
      data: { isActive: true },
    });

    return { id: productId };
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      throw new ApiError(409, "Cannot restore product due to duplicate SKU");
    }
    throw error;
  }
}
