import { query } from "../../db/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { getLocaleFallbacks, normalizeLocale } from "../i18n/i18n.service.js";

const TEMPLATE_DEFAULTS = [
  {
    template_key: "classic_invoice",
    name: "Classic Invoice",
    description: "Traditional invoice format with ruled rows and terms footer."
  },
  {
    template_key: "modern_invoice",
    name: "Modern Invoice",
    description: "Clean modern bill layout for A4 print."
  },
  {
    template_key: "thermal_80mm",
    name: "Thermal 80mm",
    description: "Compact receipt style for thermal printers."
  }
];

const DEFAULT_BILL_PROFILE = {
  businessName: "Soman Tech Foundry",
  businessDescription: "Dealers: Seeds, Fertilisers & Agro Chemicals",
  address: "",
  city: "",
  tinNo: "",
  cstNo: "",
  welNo: "",
  plNo: "",
  slNo: "",
  gstin: "",
  termsAndConditions: "Interest at 24% per annum will be charged if payment is not received within due date.\nSubject to Dindigul jurisdiction.\nGoods once sold cannot be taken back.",
  disclaimer: "",
  wholesalePaperSize: "A4"
};

async function ensureTemplateCatalog() {
  for (const template of TEMPLATE_DEFAULTS) {
    await query(
      `INSERT INTO print_template (template_key, name, description, is_active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (template_key) DO NOTHING`,
      [template.template_key, template.name, template.description]
    );
  }
}

async function ensureBusinessSettingSchema() {
  await query(
    `ALTER TABLE business_setting
     ADD COLUMN IF NOT EXISTS bill_profile JSONB NOT NULL DEFAULT '{}'::jsonb`
  );
  await query(
    `ALTER TABLE business_setting
     ADD COLUMN IF NOT EXISTS bill_profile_i18n JSONB NOT NULL DEFAULT '{}'::jsonb`
  );
}

function normalizeBillProfile(input) {
  return {
    ...DEFAULT_BILL_PROFILE,
    ...(input || {})
  };
}

export async function listPrintTemplates() {
  await ensureTemplateCatalog();
  const result = await query(
    `SELECT template_key, name, description
     FROM print_template
     WHERE is_active = true
     ORDER BY name`
  );
  return result.rows;
}

export async function getCurrentPrintTemplate(businessId, locale) {
  await ensureTemplateCatalog();
  await ensureBusinessSettingSchema();

  const localeCandidates = getLocaleFallbacks(locale);
  const result = await query(
    `SELECT bs.print_template_key, bs.bill_profile, bs.bill_profile_i18n
     FROM business_setting bs
     JOIN print_template pt ON pt.template_key = bs.print_template_key
     WHERE bs.business_id = $1 AND pt.is_active = true`,
    [businessId]
  );

  if (result.rowCount > 0) {
    const row = result.rows[0];
    const i18nMap = row.bill_profile_i18n || {};
    const localeProfile = localeCandidates
      .map((candidate) => i18nMap[candidate])
      .find((candidate) => candidate && typeof candidate === "object");

    return {
      templateKey: row.print_template_key,
      billProfile: normalizeBillProfile(localeProfile || row.bill_profile)
    };
  }

  return {
    templateKey: "classic_invoice",
    billProfile: normalizeBillProfile()
  };
}

export async function setCurrentPrintTemplate(businessId, locale, templateKey, billProfile) {
  await ensureTemplateCatalog();
  await ensureBusinessSettingSchema();
  const targetLocale = normalizeLocale(locale);
  const normalizedProfile = normalizeBillProfile(billProfile);
  const localePayload = JSON.stringify({ [targetLocale]: normalizedProfile });

  const templateRes = await query(
    `SELECT template_key
     FROM print_template
     WHERE template_key = $1 AND is_active = true`,
    [templateKey]
  );

  if (templateRes.rowCount === 0) {
    throw new ApiError(400, "Invalid print template key");
  }

  await query(
    `INSERT INTO business_setting (business_id, print_template_key, bill_profile, bill_profile_i18n, updated_at)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, NOW())
     ON CONFLICT (business_id)
     DO UPDATE SET print_template_key = EXCLUDED.print_template_key,
                   bill_profile = EXCLUDED.bill_profile,
                   bill_profile_i18n = COALESCE(business_setting.bill_profile_i18n, '{}'::jsonb) || EXCLUDED.bill_profile_i18n,
                   updated_at = NOW()`,
    [businessId, templateKey, JSON.stringify(normalizedProfile), localePayload]
  );

  return {
    templateKey,
    billProfile: normalizedProfile
  };
}
