import { pool } from "../../db/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { getLocationMap, INVENTORY_LOCATION_CODES } from "../inventory/inventoryLocation.service.js";

export async function createPurchaseOrder(businessId, payload) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const locations = await getLocationMap(client, businessId);
    const receiveLocation = locations.get(payload.receiveLocationCode);
    const mainStore = locations.get(INVENTORY_LOCATION_CODES.MAIN_STORE);
    const godown = locations.get(INVENTORY_LOCATION_CODES.GODOWN);
    if (!receiveLocation || !mainStore || !godown) {
      throw new ApiError(400, "Inventory locations are not configured");
    }

    let grossTotal = 0;
    const lockedVariants = new Map();

    for (const line of payload.items) {
      const variantRes = await client.query(
        `SELECT v.id, v.product_id, v.cost_price, v.stock_qty
         FROM product_variant v
         WHERE v.id = $1 AND v.business_id = $2 AND v.is_active = true
         FOR UPDATE`,
        [line.variantId, businessId]
      );

      if (variantRes.rowCount === 0) {
        throw new ApiError(404, `Variant not found: ${line.variantId}`);
      }

      const variant = variantRes.rows[0];
      const unitCost = Number(variant.cost_price || 0);
      grossTotal += unitCost * line.qty;
      lockedVariants.set(line.variantId, variant);
    }

    const purchaseRes = await client.query(
      `INSERT INTO purchase_order (business_id, supplier_name, payment_mode, gross_total, discount, net_total, notes, receive_location_code, created_by)
       VALUES ($1, $2, $3, $4, 0, $4, $5, $6, $7)
       RETURNING id, purchase_no, created_at, net_total`,
      [
        businessId,
        payload.supplierName || "",
        payload.paymentMode,
        grossTotal,
        payload.notes,
        receiveLocation.code,
        payload.createdBy
      ]
    );

    const purchaseOrder = purchaseRes.rows[0];

    for (const line of payload.items) {
      const variant = lockedVariants.get(line.variantId);
      const unitCost = Number(variant.cost_price || 0);

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

      await client.query(
        `INSERT INTO purchase_order_item (purchase_order_id, product_id, product_variant_id, qty, cost_price, cost_price_total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          purchaseOrder.id,
          variant.product_id,
          variant.id,
          line.qty,
          unitCost,
          unitCost * line.qty
        ]
      );

      await client.query(
        `INSERT INTO inventory_stock (business_id, variant_id, location_id, qty)
         VALUES ($1, $2, $3, 0)
         ON CONFLICT (variant_id, location_id) DO NOTHING`,
        [businessId, variant.id, receiveLocation.id]
      );

      await client.query(
        `UPDATE inventory_stock
         SET qty = qty + $1,
             updated_at = NOW()
         WHERE variant_id = $2 AND location_id = $3`,
        [line.qty, variant.id, receiveLocation.id]
      );

      await client.query(
        `UPDATE product_variant
         SET stock_qty = COALESCE((SELECT SUM(qty) FROM inventory_stock WHERE variant_id = $1), 0)
         WHERE id = $1`,
        [variant.id]
      );
    }

    await client.query("COMMIT");
    return purchaseOrder;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listPurchaseOrders(businessId) {
  const result = await pool.query(
    `SELECT po.id, po.purchase_no, po.payment_mode, po.net_total, po.created_at, po.supplier_name
     FROM purchase_order po
     WHERE po.business_id = $1
     ORDER BY po.created_at DESC
     LIMIT 100`,
    [businessId]
  );

  return result.rows;
}
