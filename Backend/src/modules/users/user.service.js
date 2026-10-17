import { query } from "../../db/index.js";
import env from "../../config/env.js";
import { ApiError } from "../../utils/ApiError.js";
import { normalizeLocale, upsertEntityTranslations } from "../i18n/i18n.service.js";

const ALLOWED_ROLES = ["admin", "owner", "viewer"];

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export async function listUsers() {
  const result = await query(
    `SELECT id, business_name, business_profile_id, business_id, full_name, email, role, is_active, created_at
     FROM app_user
     ORDER BY created_at DESC`
  );

  return result.rows;
}

export async function listBusinesses() {
  const result = await query(
    `SELECT business_id, business_name, business_profile_id, MIN(created_at) AS created_at
     FROM app_user
     GROUP BY business_id, business_name, business_profile_id
     ORDER BY business_name`
  );

  return result.rows;
}

export async function updateUserAccess(userId, payload, actor) {
  const { role, isActive } = payload;

  if (role && !ALLOWED_ROLES.includes(role)) {
    throw new ApiError(400, "Invalid role");
  }

  const targetResult = await query(
    `SELECT id, email, role, is_active
     FROM app_user
     WHERE id = $1`,
    [userId]
  );

  if (targetResult.rowCount === 0) {
    throw new ApiError(404, "User not found");
  }

  const target = targetResult.rows[0];
  const targetEmail = normalizeEmail(target.email);
  const adminEmail = normalizeEmail(env.ADMIN_EMAIL);

  if (targetEmail === adminEmail) {
    if (role && role !== "admin") {
      throw new ApiError(400, "Configured admin account role cannot be changed");
    }

    if (isActive === false) {
      throw new ApiError(400, "Configured admin account cannot be disabled");
    }
  }

  if (actor?.userId === userId && isActive === false) {
    throw new ApiError(400, "You cannot disable your own account");
  }

  const nextRole = role || target.role;
  const nextIsActive = typeof isActive === "boolean" ? isActive : target.is_active;

  const updateResult = await query(
    `UPDATE app_user
     SET role = $2, is_active = $3
     WHERE id = $1
     RETURNING id, business_name, business_profile_id, business_id, full_name, email, role, is_active, created_at`,
    [userId, nextRole, nextIsActive]
  );

  return updateResult.rows[0];
}

const ENTITY_FIELD_MAP = {
  product: ["name", "category"],
  customer: ["name", "address"]
};

function getEntityTable(entityType) {
  if (entityType === "product") return "product";
  if (entityType === "customer") return "customer";
  throw new ApiError(400, "Invalid entity type");
}

export async function listEntityTranslations({
  businessId,
  entityType,
  locale,
  search = "",
  page = 1,
  pageSize = 5
}) {
  const table = getEntityTable(entityType);
  const normalizedLocale = normalizeLocale(locale);
  const allowedFields = ENTITY_FIELD_MAP[entityType];
  const sourceExpression = entityType === "product"
    ? `CASE
         WHEN f.field_name = 'name' THEN e.name
         WHEN f.field_name = 'category' THEN e.category
         ELSE NULL
       END`
    : `CASE
         WHEN f.field_name = 'name' THEN e.name
         WHEN f.field_name = 'address' THEN e.address
         ELSE NULL
       END`;
  const offset = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(pageSize));
  const limit = Math.max(1, Number(pageSize));
  const term = String(search || "").trim().toLowerCase();

  const dataResult = await query(
    `WITH base AS (
       SELECT
         e.id AS entity_id,
         e.business_id,
         e.name AS display_name,
         f.field_name,
         ${sourceExpression} AS source_value
       FROM ${table} e
       CROSS JOIN LATERAL (
         SELECT unnest($2::text[]) AS field_name
       ) f
       WHERE e.business_id = $1
     )
     SELECT
       b.entity_id,
       b.business_id,
       b.display_name,
       b.field_name,
       COALESCE(b.source_value, '') AS source_value,
       COALESCE(et.value, '') AS translated_value
     FROM base b
     LEFT JOIN entity_translation et
       ON et.business_id = b.business_id
      AND et.entity_type = $4
      AND et.entity_id = b.entity_id
      AND et.field_name = b.field_name
      AND et.locale = $3
     WHERE (
       $5 = ''
       OR LOWER(COALESCE(b.display_name, '')) LIKE ('%' || $5 || '%')
       OR LOWER(COALESCE(b.source_value, '')) LIKE ('%' || $5 || '%')
       OR LOWER(COALESCE(et.value, '')) LIKE ('%' || $5 || '%')
     )
     ORDER BY b.display_name, b.field_name
     LIMIT $6 OFFSET $7`,
    [businessId, allowedFields, normalizedLocale, entityType, term, limit, offset]
  );

  const countResult = await query(
    `WITH base AS (
       SELECT
         e.id AS entity_id,
         e.business_id,
         e.name AS display_name,
         f.field_name,
         ${sourceExpression} AS source_value
       FROM ${table} e
       CROSS JOIN LATERAL (
         SELECT unnest($2::text[]) AS field_name
       ) f
       WHERE e.business_id = $1
     )
     SELECT COUNT(*)::int AS total
     FROM base b
     LEFT JOIN entity_translation et
       ON et.business_id = b.business_id
      AND et.entity_type = $4
      AND et.entity_id = b.entity_id
      AND et.field_name = b.field_name
      AND et.locale = $3
     WHERE (
       $5 = ''
       OR LOWER(COALESCE(b.display_name, '')) LIKE ('%' || $5 || '%')
       OR LOWER(COALESCE(b.source_value, '')) LIKE ('%' || $5 || '%')
       OR LOWER(COALESCE(et.value, '')) LIKE ('%' || $5 || '%')
     )`,
    [businessId, allowedFields, normalizedLocale, entityType, term]
  );

  return {
    rows: dataResult.rows,
    total: countResult.rows[0]?.total || 0,
    page: Math.max(1, Number(page)),
    pageSize: limit
  };
}

export async function updateEntityTranslation({
  businessId,
  entityType,
  entityId,
  fieldName,
  locale,
  value
}) {
  const table = getEntityTable(entityType);
  const allowedFields = ENTITY_FIELD_MAP[entityType];
  if (!allowedFields.includes(fieldName)) {
    throw new ApiError(400, "Invalid field name");
  }

  const entityResult = await query(
    `SELECT id, business_id
     FROM ${table}
     WHERE id = $1`,
    [entityId]
  );

  if (entityResult.rowCount === 0) {
    throw new ApiError(404, "Entity not found");
  }

  const entity = entityResult.rows[0];
  if (entity.business_id !== businessId) {
    throw new ApiError(403, "Entity does not belong to current business");
  }

  const normalizedLocale = normalizeLocale(locale);
  await upsertEntityTranslations(null, businessId, entityType, entityId, normalizedLocale, {
    [fieldName]: value
  });

  const result = await query(
    `SELECT value
     FROM entity_translation
     WHERE business_id = $1
       AND entity_type = $2
       AND entity_id = $3
       AND field_name = $4
       AND locale = $5`,
    [businessId, entityType, entityId, fieldName, normalizedLocale]
  );

  return {
    businessId,
    entityType,
    entityId,
    fieldName,
    locale: normalizedLocale,
    value: result.rows[0]?.value || ""
  };
}
