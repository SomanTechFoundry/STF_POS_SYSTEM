import { pool, query } from "../db/index.js";
import { ensureI18nSchema, normalizeLocale, upsertEntityTranslations } from "../modules/i18n/i18n.service.js";

function parseArgs(argv) {
  const args = {};
  for (const item of argv) {
    if (!item.startsWith("--")) continue;
    const [key, value] = item.slice(2).split("=");
    args[key] = value ?? "true";
  }
  return args;
}

async function insertTranslationIfMissing(businessId, entityType, entityId, fieldName, locale, value) {
  const safe = String(value ?? "").trim();
  if (!safe) return false;
  const result = await query(
    `INSERT INTO entity_translation (business_id, entity_type, entity_id, field_name, locale, value, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (business_id, entity_type, entity_id, field_name, locale) DO NOTHING`,
    [businessId, entityType, entityId, fieldName, locale, safe]
  );
  return result.rowCount > 0;
}

async function backfillProducts({ businessId, sourceLocale, targetLocale, copyTarget }) {
  const params = [];
  const where = [];
  if (businessId) {
    params.push(businessId);
    where.push(`business_id = $${params.length}`);
  }

  const result = await query(
    `SELECT id, business_id, name, category
     FROM product
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`,
    params
  );

  let sourceWrites = 0;
  let targetWrites = 0;

  for (const row of result.rows) {
    const fields = { name: row.name, category: row.category };
    await upsertEntityTranslations(null, row.business_id, "product", row.id, sourceLocale, fields);
    sourceWrites += Object.values(fields).filter((value) => String(value ?? "").trim()).length;

    if (copyTarget && targetLocale !== sourceLocale) {
      for (const [fieldName, value] of Object.entries(fields)) {
        const inserted = await insertTranslationIfMissing(
          row.business_id,
          "product",
          row.id,
          fieldName,
          targetLocale,
          value
        );
        if (inserted) targetWrites += 1;
      }
    }
  }

  return {
    records: result.rowCount,
    sourceWrites,
    targetWrites
  };
}

async function backfillCustomers({ businessId, sourceLocale, targetLocale, copyTarget }) {
  const params = [];
  const where = [];
  if (businessId) {
    params.push(businessId);
    where.push(`business_id = $${params.length}`);
  }

  const result = await query(
    `SELECT id, business_id, name, address
     FROM customer
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`,
    params
  );

  let sourceWrites = 0;
  let targetWrites = 0;

  for (const row of result.rows) {
    const fields = { name: row.name, address: row.address };
    await upsertEntityTranslations(null, row.business_id, "customer", row.id, sourceLocale, fields);
    sourceWrites += Object.values(fields).filter((value) => String(value ?? "").trim()).length;

    if (copyTarget && targetLocale !== sourceLocale) {
      for (const [fieldName, value] of Object.entries(fields)) {
        const inserted = await insertTranslationIfMissing(
          row.business_id,
          "customer",
          row.id,
          fieldName,
          targetLocale,
          value
        );
        if (inserted) targetWrites += 1;
      }
    }
  }

  return {
    records: result.rowCount,
    sourceWrites,
    targetWrites
  };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const businessId = args["business-id"] || "";
  const sourceLocale = normalizeLocale(args["source-locale"] || process.env.I18N_SOURCE_LOCALE || "en-IN");
  const targetLocale = normalizeLocale(args["target-locale"] || process.env.I18N_TARGET_LOCALE || "ta-IN");
  const copyTarget = args["copy-target"] !== "false";

  console.log("[i18n-backfill] start");
  console.log(`[i18n-backfill] businessId=${businessId || "ALL"}`);
  console.log(`[i18n-backfill] sourceLocale=${sourceLocale}`);
  console.log(`[i18n-backfill] targetLocale=${targetLocale} copyTarget=${copyTarget}`);

  await ensureI18nSchema();

  const productStats = await backfillProducts({ businessId, sourceLocale, targetLocale, copyTarget });
  const customerStats = await backfillCustomers({ businessId, sourceLocale, targetLocale, copyTarget });

  console.log("[i18n-backfill] done");
  console.log(
    `[i18n-backfill] products: records=${productStats.records}, sourceWrites=${productStats.sourceWrites}, targetWrites=${productStats.targetWrites}`
  );
  console.log(
    `[i18n-backfill] customers: records=${customerStats.records}, sourceWrites=${customerStats.sourceWrites}, targetWrites=${customerStats.targetWrites}`
  );
}

run()
  .catch((error) => {
    console.error("[i18n-backfill] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

