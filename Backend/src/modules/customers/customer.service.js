import { query } from "../../db/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { resolveEntityTranslations, upsertEntityTranslations } from "../i18n/i18n.service.js";

export async function listCustomers(businessId, locale) {
  const result = await query(
    `SELECT id, name, address, mobile, email, created_at
     FROM customer
     WHERE business_id = $1
     ORDER BY created_at DESC`,
    [businessId]
  );

  const rows = result.rows;
  const customerIds = rows.map((row) => row.id);
  const translations = await resolveEntityTranslations(
    null,
    businessId,
    "customer",
    customerIds,
    ["name", "address"],
    locale
  );

  return rows.map((row) => {
    const translated = translations.get(row.id) || {};
    return {
      ...row,
      name: translated.name || row.name,
      address: translated.address || row.address
    };
  });
}

export async function createCustomer(businessId, payload, locale) {
  const result = await query(
    `INSERT INTO customer (business_id, name, address, mobile, email)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, address, mobile, email, created_at`,
    [businessId, payload.name, payload.address, payload.mobile, payload.email]
  );

  const created = result.rows[0];
  await upsertEntityTranslations(
    null,
    businessId,
    "customer",
    created.id,
    locale,
    {
      name: payload.name,
      address: payload.address
    }
  );
  return created;
}

export async function updateCustomer(businessId, customerId, payload, locale) {
  const result = await query(
    `UPDATE customer
     SET name = $3,
         address = $4,
         mobile = $5,
         email = $6
     WHERE id = $1 AND business_id = $2
     RETURNING id, name, address, mobile, email, created_at`,
    [customerId, businessId, payload.name, payload.address, payload.mobile, payload.email]
  );

  if (result.rowCount === 0) {
    throw new ApiError(404, "Customer not found");
  }

  const updated = result.rows[0];
  await upsertEntityTranslations(
    null,
    businessId,
    "customer",
    updated.id,
    locale,
    {
      name: payload.name,
      address: payload.address
    }
  );
  return updated;
}

export async function deleteCustomer(businessId, customerId) {
  const result = await query(
    `DELETE FROM customer
     WHERE id = $1 AND business_id = $2
     RETURNING id`,
    [customerId, businessId]
  );

  if (result.rowCount === 0) {
    throw new ApiError(404, "Customer not found");
  }

  return { id: customerId };
}
