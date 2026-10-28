import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/errors";
import {
  getLocationMap,
  INVENTORY_LOCATION_CODES,
  syncVariantStockQty,
} from "@/lib/services/inventory.service";

export type PurchaseOrderLineInput = {
  variantId: string;
  qty: number;
};

export type CreatePurchaseOrderPayload = {
  supplierName?: string;
  receiveLocationCode: string;
  paymentMode: string;
  notes?: string;
  createdBy: string;
  items: PurchaseOrderLineInput[];
};

type LockedVariant = {
  id: string;
  product_id: string;
  cost_price: unknown;
  stock_qty: number;
};

export async function createPurchaseOrder(businessId: string, payload: CreatePurchaseOrderPayload) {
  return prisma.$transaction(async (tx) => {
    const locations = await getLocationMap(tx, businessId);
    const receiveLocation = locations.get(payload.receiveLocationCode);
    const mainStore = locations.get(INVENTORY_LOCATION_CODES.MAIN_STORE);
    const godown = locations.get(INVENTORY_LOCATION_CODES.GODOWN);

    if (!receiveLocation || !mainStore || !godown) {
      throw new ApiError(400, "Inventory locations are not configured");
    }

    let grossTotal = 0;
    const lockedVariants = new Map<string, LockedVariant>();

    for (const line of payload.items) {
      const locked = await tx.$queryRaw<LockedVariant[]>`
        SELECT id, product_id, cost_price, stock_qty
        FROM product_variant
        WHERE id = ${line.variantId}::uuid
          AND business_id = ${businessId}::uuid
          AND is_active = true
        FOR UPDATE
      `;

      if (!locked.length) {
        throw new ApiError(404, `Variant not found: ${line.variantId}`);
      }

      const variant = locked[0];
      const unitCost = Number(variant.cost_price || 0);
      grossTotal += unitCost * line.qty;
      lockedVariants.set(line.variantId, variant);
    }

    const purchaseOrder = await tx.purchaseOrder.create({
      data: {
        businessId,
        supplierName: payload.supplierName || "",
        paymentMode: payload.paymentMode,
        grossTotal,
        discount: 0,
        netTotal: grossTotal,
        notes: payload.notes || "",
        receiveLocationCode: receiveLocation.code,
        createdBy: payload.createdBy,
      },
    });

    for (const line of payload.items) {
      const variant = lockedVariants.get(line.variantId);
      if (!variant) {
        throw new ApiError(404, `Variant not found: ${line.variantId}`);
      }
      const unitCost = Number(variant.cost_price || 0);

      const stockRows = await tx.inventoryStock.count({ where: { variantId: variant.id } });
      if (stockRows === 0) {
        await tx.inventoryStock.createMany({
          data: [
            {
              businessId,
              variantId: variant.id,
              locationId: mainStore.id,
              qty: Number(variant.stock_qty || 0),
            },
            {
              businessId,
              variantId: variant.id,
              locationId: godown.id,
              qty: 0,
            },
          ],
          skipDuplicates: true,
        });
      }

      await tx.purchaseOrderItem.create({
        data: {
          purchaseOrderId: purchaseOrder.id,
          productId: variant.product_id,
          productVariantId: variant.id,
          qty: line.qty,
          costPrice: unitCost,
          costPriceTotal: unitCost * line.qty,
        },
      });

      await tx.inventoryStock.upsert({
        where: {
          variantId_locationId: {
            variantId: variant.id,
            locationId: receiveLocation.id,
          },
        },
        create: {
          businessId,
          variantId: variant.id,
          locationId: receiveLocation.id,
          qty: 0,
        },
        update: {},
      });

      await tx.inventoryStock.updateMany({
        where: { variantId: variant.id, locationId: receiveLocation.id },
        data: { qty: { increment: line.qty } },
      });

      await syncVariantStockQty(tx, variant.id);
    }

    return {
      id: purchaseOrder.id,
      purchase_no: Number(purchaseOrder.purchaseNo),
      created_at: purchaseOrder.createdAt,
      net_total: Number(purchaseOrder.netTotal),
    };
  });
}

export async function listPurchaseOrders(businessId: string) {
  const rows = await prisma.purchaseOrder.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return rows.map((po) => ({
    id: po.id,
    purchase_no: Number(po.purchaseNo),
    payment_mode: po.paymentMode,
    net_total: Number(po.netTotal),
    created_at: po.createdAt,
    supplier_name: po.supplierName,
  }));
}
