import { query } from "../../db/index.js";

const DEFAULT_LOCALE = "en-IN";

export function normalizeLocale(input) {
  const raw = String(input || "").trim();
  if (!raw) return DEFAULT_LOCALE;
  const [langPart = "en", regionPart] = raw.replace("_", "-").split("-");
  const lang = langPart.toLowerCase();
  const region = regionPart ? regionPart.toUpperCase() : (lang === "ta" ? "IN" : "IN");
  return `${lang}-${region}`;
}

export function getLocaleFallbacks(locale) {
  const normalized = normalizeLocale(locale);
  const [lang] = normalized.split("-");
  return [normalized, lang];
}

export async function ensureI18nSchema() {
  await query(
    `CREATE TABLE IF NOT EXISTS entity_translation (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       business_id UUID NOT NULL,
       entity_type VARCHAR(40) NOT NULL,
       entity_id UUID NOT NULL,
       field_name VARCHAR(40) NOT NULL,
       locale VARCHAR(20) NOT NULL,
       value TEXT NOT NULL DEFAULT '',
       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       UNIQUE (business_id, entity_type, entity_id, field_name, locale)
     )`
  );
}

function resolveQueryRunner(runner) {
  if (runner && typeof runner.query === "function") return runner;
  return { query };
}

export async function upsertEntityTranslations(runner, businessId, entityType, entityId, locale, fields) {
  const db = resolveQueryRunner(runner);
  await ensureI18nSchema();
  const targetLocale = normalizeLocale(locale);

  for (const [fieldName, rawValue] of Object.entries(fields || {})) {
    const value = String(rawValue ?? "").trim();
    if (!value) {
      await db.query(
        `DELETE FROM entity_translation
         WHERE business_id = $1 AND entity_type = $2 AND entity_id = $3 AND field_name = $4 AND locale = $5`,
        [businessId, entityType, entityId, fieldName, targetLocale]
      );
      continue;
    }

    await db.query(
      `INSERT INTO entity_translation (business_id, entity_type, entity_id, field_name, locale, value, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (business_id, entity_type, entity_id, field_name, locale)
       DO UPDATE SET value = EXCLUDED.value,
                     updated_at = NOW()`,
      [businessId, entityType, entityId, fieldName, targetLocale, value]
    );
  }
}

export async function resolveEntityTranslations(runner, businessId, entityType, entityIds, fieldNames, locale) {
  const db = resolveQueryRunner(runner);
  await ensureI18nSchema();
  const ids = Array.isArray(entityIds) ? entityIds.filter(Boolean) : [];
  if (ids.length === 0) return new Map();

  const fields = Array.isArray(fieldNames) ? fieldNames.filter(Boolean) : [];
  if (fields.length === 0) return new Map();

  const locales = getLocaleFallbacks(locale);
  const result = await db.query(
    `SELECT entity_id, field_name, locale, value
     FROM entity_translation
     WHERE business_id = $1
       AND entity_type = $2
       AND entity_id = ANY($3::uuid[])
       AND field_name = ANY($4::text[])
       AND locale = ANY($5::text[])`,
    [businessId, entityType, ids, fields, locales]
  );

  const localeRank = new Map(locales.map((value, index) => [value, index]));
  const byEntity = new Map();

  for (const row of result.rows) {
    const entityId = row.entity_id;
    const fieldName = row.field_name;
    const rank = localeRank.has(row.locale) ? localeRank.get(row.locale) : 999;

    if (!byEntity.has(entityId)) byEntity.set(entityId, {});
    const current = byEntity.get(entityId)[fieldName];
    if (!current || rank < current.rank) {
      byEntity.get(entityId)[fieldName] = { value: row.value, rank };
    }
  }

  const resolved = new Map();
  for (const [entityId, fieldMap] of byEntity.entries()) {
    const output = {};
    for (const [fieldName, item] of Object.entries(fieldMap)) {
      output[fieldName] = item.value;
    }
    resolved.set(entityId, output);
  }

  return resolved;
}

