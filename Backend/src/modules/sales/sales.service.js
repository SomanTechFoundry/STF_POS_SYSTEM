import { pool } from "../../db/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { getLocationMap, INVENTORY_LOCATION_CODES } from "../inventory/inventoryLocation.service.js";
import { upsertEntityTranslations } from "../i18n/i18n.service.js";

async function ensureSaleSchema(client) {
  await client.query(
    `ALTER TABLE sale
     ADD COLUMN IF NOT EXISTS wholesale_fl_pl_sl_no VARCHAR(120) NOT NULL DEFAULT ''`
  );
  await client.query(
    `ALTER TABLE sale
     ADD COLUMN IF NOT EXISTS wholesale_tin_no VARCHAR(120) NOT NULL DEFAULT ''`
  );
}

export async function createSale(businessId, payload, locale) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await ensureSaleSchema(client);
    const locations = await getLocationMap(client, businessId);
    const sourceLocation = locations.get(payload.sourceLocationCode);
    const mainStore = locations.get(INVENTORY_LOCATION_CODES.MAIN_STORE);
    const godown = locations.get(INVENTORY_LOCATION_CODES.GODOWN);
    if (!sourceLocation || !mainStore || !godown) {
      throw new ApiError(400, "Inventory locations are not configured");
    }

    let grossTotal = 0;
    const variantStockById = new Map();

    for (const line of payload.items) {
      const variantRes = await client.query(
        `SELECT v.id, v.product_id, v.sale_price, v.stock_qty, v.cost_price
         FROM product_variant v
         WHERE v.id = $1 AND v.business_id = $2 AND v.is_active = true
         FOR UPDATE`,
        [line.variantId, businessId]
      );

      if (variantRes.rowCount === 0) {
        throw new ApiError(404, `Variant not found: ${line.variantId}`);
      }

      const variant = variantRes.rows[0];
      const stockRowsRes = await client.query(
        `SELECT COUNT(*)::int AS rows_count
         FROM inventory_stock
         WHERE variant_id = $1`,
        [variant.id]
      );

      if (Number(stockRowsRes.rows[0]?.rows_count || 0) === 0) {
        await client.query(
          `INSERT INTO inventory_stock (business_id, variant_id, location_id, qty)
           VALUES ($1, $2, $3, $4), ($1, $2, $5, 0)
           ON CONFLICT (variant_id, location_id) DO NOTHING`,
          [businessId, variant.id, mainStore.id, Number(variant.stock_qty || 0), godown.id]
        );
      }

      const stockAtLocationRes = await client.query(
        `SELECT qty
         FROM inventory_stock
         WHERE variant_id = $1 AND location_id = $2
         FOR UPDATE`,
        [variant.id, sourceLocation.id]
      );

      const stockAtLocation = Number(stockAtLocationRes.rows[0]?.qty || 0);
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

      const hasCustomerDetails = name || address || mobile || email;

      if (hasCustomerDetails) {
        if (!name) {
          throw new ApiError(400, "Customer name is required for new customer entry");
        }

        const customerRes = await client.query(
          `INSERT INTO customer (business_id, name, address, mobile, email)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [businessId, name, address, mobile, email]
        );

        resolvedCustomerId = customerRes.rows[0].id;
        await upsertEntityTranslations(
          client,
          businessId,
          "customer",
          resolvedCustomerId,
          locale,
          { name, address }
        );
      }
    }

    if (payload.orderType === "wholesale" && !resolvedCustomerId) {
      throw new ApiError(400, "Customer is required for wholesale orders");
    }

    const saleRes = await client.query(
      `INSERT INTO sale (business_id, order_type, customer_id, payment_mode, gross_total, discount, net_total, notes, wholesale_tin_no, wholesale_fl_pl_sl_no, source_location_code, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, bill_no, order_type, created_at, net_total, wholesale_tin_no, wholesale_fl_pl_sl_no`,
      [
        businessId,
        payload.orderType || "retail",
        resolvedCustomerId,
        payload.paymentMode,
        grossTotal,
        payload.discount,
        grossTotal - payload.discount,
        payload.notes,
        payload.wholesaleTinNo || "",
        payload.wholesaleFlPlSlNo || "",
        sourceLocation.code,
        payload.createdBy
      ]
    );

    const sale = saleRes.rows[0];

    for (const line of payload.items) {
      const variant = variantStockById.get(line.variantId)?.variant;
      if (!variant) {
        throw new ApiError(404, `Variant not found: ${line.variantId}`);
      }
      const sellingPrice = Number(variant.sale_price);
      const costPrice = Number(variant.cost_price || 0);

      await client.query(
        `INSERT INTO sale_item (sale_id, product_id, product_variant_id, qty, selling_price, selling_price_total, cost_price, cost_price_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          sale.id,
          variant.product_id,
          variant.id,
          line.qty,
          sellingPrice,
          sellingPrice * line.qty,
          costPrice,
          costPrice * line.qty
        ]
      );

      await client.query(
        `UPDATE inventory_stock
         SET qty = qty - $1,
             updated_at = NOW()
         WHERE variant_id = $2 AND location_id = $3`,
        [line.qty, variant.id, sourceLocation.id]
      );

      await client.query(
        `UPDATE product_variant
         SET stock_qty = COALESCE((SELECT SUM(qty) FROM inventory_stock WHERE variant_id = $1), 0)
         WHERE id = $1`,
        [variant.id]
      );
    }

    await client.query("COMMIT");

    return sale;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listSales(businessId) {
  await pool.query(
    `ALTER TABLE sale
     ADD COLUMN IF NOT EXISTS wholesale_fl_pl_sl_no VARCHAR(120) NOT NULL DEFAULT ''`
  );
  await pool.query(
    `ALTER TABLE sale
     ADD COLUMN IF NOT EXISTS wholesale_tin_no VARCHAR(120) NOT NULL DEFAULT ''`
  );

  const result = await pool.query(
    `SELECT s.id, s.bill_no, s.order_type, s.payment_mode, s.net_total, s.created_at,
            s.wholesale_tin_no,
            s.wholesale_fl_pl_sl_no,
            c.name AS customer_name
     FROM sale s
     LEFT JOIN customer c ON c.id = s.customer_id
     WHERE s.business_id = $1
     ORDER BY s.created_at DESC
     LIMIT 100`,
    [businessId]
  );

  return result.rows;
}
