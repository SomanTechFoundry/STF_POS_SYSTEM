import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/errors";
import {
  getLocationMap,
  INVENTORY_LOCATION_CODES,
  syncVariantStockQty,
} from "@/lib/services/inventory.service";
import { upsertEntityTranslations } from "@/lib/services/i18n.service";

export type SaleLineInput = {
  variantId: string;
  qty: number;
};

export type CreateSalePayload = {
  orderType?: "retail" | "wholesale";
  customerId?: string | null;
  customer?: {
    name?: string;
    address?: string;
    mobile?: string;
    email?: string;
  };
  wholesaleTinNo?: string;
  wholesaleFlPlSlNo?: string;
  sourceLocationCode: string;
  paymentMode: string;
  discount: number;
  notes?: string;
  createdBy: string;
  items: SaleLineInput[];
};

type LockedVariant = {
  id: string;
  product_id: string;
  sale_price: unknown;
  stock_qty: number;
  cost_price: unknown;
};

export async function createSale(businessId: string, payload: CreateSalePayload, locale: string) {
  return prisma.$transaction(async (tx) => {
    const locations = await getLocationMap(tx, businessId);
    const sourceLocation = locations.get(payload.sourceLocationCode);
    const mainStore = locations.get(INVENTORY_LOCATION_CODES.MAIN_STORE);
    const godown = locations.get(INVENTORY_LOCATION_CODES.GODOWN);

    if (!sourceLocation || !mainStore || !godown) {
      throw new ApiError(400, "Inventory locations are not configured");
    }

    let grossTotal = 0;
    const variantStockById = new Map<string, { variant: LockedVariant; stockAtLocation: number }>();

    for (const line of payload.items) {
      const locked = await tx.$queryRaw<LockedVariant[]>`
        SELECT id, product_id, sale_price, stock_qty, cost_price
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

      const stockAtLocationRows = await tx.$queryRaw<Array<{ qty: number }>>`
        SELECT qty
        FROM inventory_stock
        WHERE variant_id = ${variant.id}::uuid AND location_id = ${sourceLocation.id}::uuid
        FOR UPDATE
      `;

      const stockAtLocation = Number(stockAtLocationRows[0]?.qty || 0);
      if (stockAtLocation < line.qty) {
        throw new ApiError(400, `Insufficient stock for variant: ${line.variantId}`);
      }

      grossTotal += Number(variant.sale_price) * line.qty;
      variantStockById.set(line.variantId, { variant, stockAtLocation });
    }

    let resolvedCustomerId = payload.customerId ?? null;

    if (!resolvedCustomerId && payload.customer) {
      const name = String(payload.customer.name || "").trim();
      const address = String(payload.customer.address || "").trim();
      const mobile = String(payload.customer.mobile || "").trim();
      const email = String(payload.customer.email || "").trim();
      const hasCustomerDetails = Boolean(name || address || mobile || email);

      if (hasCustomerDetails) {
        if (!name) {
          throw new ApiError(400, "Customer name is required for new customer entry");
        }

        const customer = await tx.customer.create({
          data: { businessId, name, address, mobile, email },
        });
        resolvedCustomerId = customer.id;
        await upsertEntityTranslations(tx, businessId, "customer", resolvedCustomerId, locale, {
          name,
          address,
        });
      }
    }

    if (payload.orderType === "wholesale" && !resolvedCustomerId) {
      throw new ApiError(400, "Customer is required for wholesale orders");
    }

    const sale = await tx.sale.create({
      data: {
        businessId,
        orderType: payload.orderType || "retail",
        customerId: resolvedCustomerId,
        paymentMode: payload.paymentMode,
        grossTotal,
        discount: payload.discount,
        netTotal: grossTotal - payload.discount,
        notes: payload.notes || "",
        wholesaleTinNo: payload.wholesaleTinNo || "",
        wholesaleFlPlSlNo: payload.wholesaleFlPlSlNo || "",
        sourceLocationCode: sourceLocation.code,
        createdBy: payload.createdBy,
      },
    });

    for (const line of payload.items) {
      const variant = variantStockById.get(line.variantId)?.variant;
      if (!variant) {
        throw new ApiError(404, `Variant not found: ${line.variantId}`);
      }

      const sellingPrice = Number(variant.sale_price);
      const costPrice = Number(variant.cost_price || 0);

      await tx.saleItem.create({
        data: {
          saleId: sale.id,
          productId: variant.product_id,
          productVariantId: variant.id,
          qty: line.qty,
          sellingPrice,
          sellingPriceTotal: sellingPrice * line.qty,
          costPrice,
          costPriceTotal: costPrice * line.qty,
        },
      });

      await tx.inventoryStock.updateMany({
        where: { variantId: variant.id, locationId: sourceLocation.id },
        data: { qty: { decrement: line.qty } },
      });

      await syncVariantStockQty(tx, variant.id);
    }

    return {
      id: sale.id,
      bill_no: Number(sale.billNo),
      order_type: sale.orderType,
      created_at: sale.createdAt,
      net_total: Number(sale.netTotal),
      wholesale_tin_no: sale.wholesaleTinNo,
      wholesale_fl_pl_sl_no: sale.wholesaleFlPlSlNo,
    };
  });
}

export async function listSales(businessId: string) {
  const rows = await prisma.sale.findMany({
    where: { businessId },
    include: { customer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return rows.map((sale) => ({
    id: sale.id,
    bill_no: Number(sale.billNo),
    order_type: sale.orderType,
    payment_mode: sale.paymentMode,
    net_total: Number(sale.netTotal),
    created_at: sale.createdAt,
    wholesale_tin_no: sale.wholesaleTinNo,
    wholesale_fl_pl_sl_no: sale.wholesaleFlPlSlNo,
    customer_name: sale.customer?.name ?? null,
  }));
}
