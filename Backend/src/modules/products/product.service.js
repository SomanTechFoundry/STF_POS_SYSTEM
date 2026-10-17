import { query } from "../../db/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { getLocationMap } from "../inventory/inventoryLocation.service.js";
import { resolveEntityTranslations, upsertEntityTranslations } from "../i18n/i18n.service.js";

const productSelect = "p.id, p.name, p.category, p.created_at";
const dbRunner = { query };

function mapVariantRow(row) {
  return {
    id: row.variant_id,
    sku: row.variant_sku,
    unit_type: row.variant_unit_type,
    unit_size: row.variant_unit_size,
    cost_price: row.variant_cost_price,
    sale_price: row.variant_sale_price,
    stock_qty: row.variant_stock_qty,
    reorder_level: row.variant_reorder_level,
    created_at: row.variant_created_at,
    location_stocks: Array.isArray(row.variant_location_stocks) ? row.variant_location_stocks : []
  };
}

function groupProducts(rows) {
  const byId = new Map();

  rows.forEach((row) => {
    if (!byId.has(row.id)) {
      byId.set(row.id, {
        id: row.id,
        name: row.name,
        category: row.category,
        created_at: row.created_at,
        variants: []
      });
    }

    if (row.variant_id) {
      byId.get(row.id).variants.push(mapVariantRow(row));
    }
  });

  return Array.from(byId.values());
}

export async function listProducts(businessId, locale) {
  const result = await query(
    `SELECT ${productSelect},
            v.id AS variant_id,
            v.sku AS variant_sku,
            v.unit_type AS variant_unit_type,
            v.unit_size AS variant_unit_size,
            v.cost_price AS variant_cost_price,
            v.sale_price AS variant_sale_price,
            v.stock_qty AS variant_stock_qty,
            v.reorder_level AS variant_reorder_level,
            v.created_at AS variant_created_at,
            COALESCE(loc.location_stocks, '[]'::json) AS variant_location_stocks
     FROM product p
     LEFT JOIN product_variant v
       ON v.product_id = p.id AND v.is_active = true
     LEFT JOIN LATERAL (
       SELECT json_agg(
                json_build_object(
                  'location_code', l.code,
                  'location_name', l.name,
                  'qty', COALESCE(s.qty, 0)
                )
                ORDER BY l.code
              ) AS location_stocks
       FROM inventory_location l
       LEFT JOIN inventory_stock s
         ON s.location_id = l.id AND s.variant_id = v.id
       WHERE l.business_id = p.business_id
     ) loc ON true
     WHERE p.business_id = $1 AND p.is_active = true
     ORDER BY p.created_at DESC, v.created_at ASC`,
    [businessId]
  );

  const products = groupProducts(result.rows);
  const productIds = products.map((item) => item.id);
  const translations = await resolveEntityTranslations(
    null,
    businessId,
    "product",
    productIds,
    ["name", "category"],
    locale
  );

  return products.map((product) => {
    const translated = translations.get(product.id) || {};
    return {
      ...product,
      name: translated.name || product.name,
      category: translated.category || product.category
    };
  });
}

export async function listArchivedProducts(businessId, locale) {
  const result = await query(
    `SELECT ${productSelect},
            v.id AS variant_id,
            v.sku AS variant_sku,
            v.unit_type AS variant_unit_type,
            v.unit_size AS variant_unit_size,
            v.cost_price AS variant_cost_price,
            v.sale_price AS variant_sale_price,
            v.stock_qty AS variant_stock_qty,
            v.reorder_level AS variant_reorder_level,
            v.created_at AS variant_created_at,
            COALESCE(loc.location_stocks, '[]'::json) AS variant_location_stocks
     FROM product p
     LEFT JOIN product_variant v
       ON v.product_id = p.id
     LEFT JOIN LATERAL (
       SELECT json_agg(
                json_build_object(
                  'location_code', l.code,
                  'location_name', l.name,
                  'qty', COALESCE(s.qty, 0)
                )
                ORDER BY l.code
              ) AS location_stocks
       FROM inventory_location l
       LEFT JOIN inventory_stock s
         ON s.location_id = l.id AND s.variant_id = v.id
       WHERE l.business_id = p.business_id
     ) loc ON true
     WHERE p.business_id = $1 AND p.is_active = false
     ORDER BY p.created_at DESC, v.created_at ASC`,
    [businessId]
  );

  const products = groupProducts(result.rows);
  const productIds = products.map((item) => item.id);
  const translations = await resolveEntityTranslations(
    null,
    businessId,
    "product",
    productIds,
    ["name", "category"],
    locale
  );

  return products.map((product) => {
    const translated = translations.get(product.id) || {};
    return {
      ...product,
      name: translated.name || product.name,
      category: translated.category || product.category
    };
  });
}

async function upsertVariants(businessId, productId, variants) {
  const locations = await getLocationMap(dbRunner, businessId);
  const mainStore = locations.get("main_store");
  const godown = locations.get("godown");

  if (!mainStore || !godown) {
    throw new ApiError(500, "Inventory locations are not configured");
  }

  const existingResult = await query(
    "SELECT id FROM product_variant WHERE product_id = $1",
    [productId]
  );
  const existingIds = new Set(existingResult.rows.map((row) => row.id));
  const incomingIds = new Set(variants.map((variant) => variant.id).filter(Boolean));

  for (const existingId of existingIds) {
    if (!incomingIds.has(existingId)) {
      await query(
        "UPDATE product_variant SET is_active = false WHERE id = $1",
        [existingId]
      );
    }
  }

  for (const variant of variants) {
    if (variant.id) {
      await query(
        `UPDATE product_variant
         SET sku = $3,
             unit_type = $4,
             unit_size = $5,
             cost_price = $6,
             sale_price = $7,
             stock_qty = $8,
             reorder_level = $9,
             is_active = true
         WHERE id = $1 AND product_id = $2`,
        [
          variant.id,
          productId,
          variant.sku,
          variant.unitType,
          variant.unitSize,
          variant.costPrice,
          variant.salePrice,
          variant.stockQty,
          variant.reorderLevel
        ]
      );

      const stockRes = await query(
        `SELECT COALESCE(SUM(qty), 0)::int AS total_qty
         FROM inventory_stock
         WHERE variant_id = $1`,
        [variant.id]
      );

      const currentTotal = Number(stockRes.rows[0]?.total_qty || 0);
      const targetTotal = Number(variant.stockQty);
      const delta = targetTotal - currentTotal;

      await query(
        `INSERT INTO inventory_stock (business_id, variant_id, location_id, qty)
         VALUES ($1, $2, $3, 0)
         ON CONFLICT (variant_id, location_id) DO NOTHING`,
        [businessId, variant.id, mainStore.id]
      );
      await query(
        `INSERT INTO inventory_stock (business_id, variant_id, location_id, qty)
         VALUES ($1, $2, $3, 0)
         ON CONFLICT (variant_id, location_id) DO NOTHING`,
        [businessId, variant.id, godown.id]
      );

      if (delta !== 0) {
        const adjustResult = await query(
          `UPDATE inventory_stock
           SET qty = qty + $1,
               updated_at = NOW()
           WHERE variant_id = $2 AND location_id = $3 AND qty + $1 >= 0`,
          [delta, variant.id, mainStore.id]
        );

        if (adjustResult.rowCount === 0) {
          throw new ApiError(400, "Cannot reduce below available stock in Main Store");
        }
      }

      await query(
        `UPDATE product_variant
         SET stock_qty = COALESCE((SELECT SUM(qty) FROM inventory_stock WHERE variant_id = $1), 0)
         WHERE id = $1`,
        [variant.id]
      );
    } else {
      const insertRes = await query(
        `INSERT INTO product_variant (product_id, business_id, sku, unit_type, unit_size, cost_price, sale_price, stock_qty, reorder_level, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
         RETURNING id`,
        [
          productId,
          businessId,
          variant.sku,
          variant.unitType,
          variant.unitSize,
          variant.costPrice,
          variant.salePrice,
          variant.stockQty,
          variant.reorderLevel
        ]
      );

      const createdVariantId = insertRes.rows?.[0]?.id;
      if (!createdVariantId) {
        throw new ApiError(500, "Failed to create product variant");
      }
      await query(
        `INSERT INTO inventory_stock (business_id, variant_id, location_id, qty)
         VALUES ($1, $2, $3, $4), ($1, $2, $5, 0)
         ON CONFLICT (variant_id, location_id) DO NOTHING`,
        [businessId, createdVariantId, mainStore.id, variant.stockQty, godown.id]
      );
    }
  }
}

export async function createProduct(businessId, payload, locale) {
  const result = await query(
    `INSERT INTO product (business_id, name, category, is_active)
     VALUES ($1, $2, $3, true)
     RETURNING id`,
    [
      businessId,
      payload.name,
      payload.category
    ]
  );

  const productId = result.rows[0].id;
  await upsertEntityTranslations(
    null,
    businessId,
    "product",
    productId,
    locale,
    {
      name: payload.name,
      category: payload.category
    }
  );
  await upsertVariants(businessId, productId, payload.variants);

  return { id: productId };
}

export async function updateProduct(businessId, productId, payload, locale) {
  const result = await query(
    `UPDATE product
     SET name = $3,
         category = $4
     WHERE id = $1 AND business_id = $2 AND is_active = true
     RETURNING id`,
    [
      productId,
      businessId,
      payload.name,
      payload.category
    ]
  );

  if (result.rowCount === 0) {
    throw new ApiError(404, "Product not found");
  }

  await upsertEntityTranslations(
    null,
    businessId,
    "product",
    productId,
    locale,
    {
      name: payload.name,
      category: payload.category
    }
  );

  await upsertVariants(businessId, productId, payload.variants);

  return { id: productId };
}

export async function deleteProduct(businessId, productId) {
  const result = await query(
    `UPDATE product
     SET is_active = false
     WHERE id = $1 AND business_id = $2 AND is_active = true
     RETURNING id`,
    [productId, businessId]
  );

  if (result.rowCount === 0) {
    throw new ApiError(404, "Product not found");
  }

  await query(
    "UPDATE product_variant SET is_active = false WHERE product_id = $1",
    [productId]
  );

  return { id: productId, archived: true };
}

export async function restoreProduct(businessId, productId) {
  try {
    const result = await query(
      `UPDATE product
       SET is_active = true
       WHERE id = $1 AND business_id = $2 AND is_active = false
       RETURNING id`,
      [productId, businessId]
    );

    if (result.rowCount === 0) {
      throw new ApiError(404, "Archived product not found");
    }

    await query(
      "UPDATE product_variant SET is_active = true WHERE product_id = $1",
      [productId]
    );

    return { id: productId };
  } catch (error) {
    if (error?.code === "23505") {
      throw new ApiError(409, "Cannot restore product due to duplicate SKU");
    }
    throw error;
  }
}
