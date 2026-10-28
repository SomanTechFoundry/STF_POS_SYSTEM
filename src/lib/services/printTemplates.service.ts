import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/errors";
import { getLocaleFallbacks, normalizeLocale } from "@/lib/services/i18n.service";

const TEMPLATE_DEFAULTS = [
  {
    templateKey: "classic_invoice",
    name: "Classic Invoice",
    description: "Traditional invoice format with ruled rows and terms footer.",
  },
  {
    templateKey: "modern_invoice",
    name: "Modern Invoice",
    description: "Clean modern bill layout for A4 print.",
  },
  {
    templateKey: "thermal_80mm",
    name: "Thermal 80mm",
    description: "Compact receipt style for thermal printers.",
  },
] as const;

const DEFAULT_BILL_PROFILE: Record<string, string> = {
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
  termsAndConditions:
    "Interest at 24% per annum will be charged if payment is not received within due date.\nSubject to Dindigul jurisdiction.\nGoods once sold cannot be taken back.",
  disclaimer: "",
  wholesalePaperSize: "A4",
};

async function ensureTemplateCatalog() {
  for (const template of TEMPLATE_DEFAULTS) {
    await prisma.printTemplate.upsert({
      where: { templateKey: template.templateKey },
      create: {
        templateKey: template.templateKey,
        name: template.name,
        description: template.description,
        isActive: true,
      },
      update: {},
    });
  }
}

function normalizeBillProfile(input?: Record<string, string> | null) {
  return {
    ...DEFAULT_BILL_PROFILE,
    ...(input || {}),
  };
}

export async function listPrintTemplates() {
  await ensureTemplateCatalog();
  const rows = await prisma.printTemplate.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { templateKey: true, name: true, description: true },
  });

  return rows.map((row) => ({
    template_key: row.templateKey,
    name: row.name,
    description: row.description,
  }));
}

export async function getCurrentPrintTemplate(businessId: string, locale: string) {
  await ensureTemplateCatalog();

  const localeCandidates = getLocaleFallbacks(locale);
  const setting = await prisma.businessSetting.findFirst({
    where: {
      businessId,
      printTemplate: { isActive: true },
    },
  });

  if (setting) {
    const i18nMap =
      setting.billProfileI18n && typeof setting.billProfileI18n === "object"
        ? (setting.billProfileI18n as Record<string, Record<string, string>>)
        : {};
    const localeProfile = localeCandidates
      .map((candidate) => i18nMap[candidate])
      .find((candidate) => candidate && typeof candidate === "object");

    const baseProfile =
      setting.billProfile && typeof setting.billProfile === "object"
        ? (setting.billProfile as Record<string, string>)
        : {};

    return {
      templateKey: setting.printTemplateKey,
      billProfile: normalizeBillProfile(localeProfile || baseProfile),
    };
  }

  return {
    templateKey: "classic_invoice",
    billProfile: normalizeBillProfile(),
  };
}

export async function updateCurrentPrintTemplate(
  businessId: string,
  locale: string,
  templateKey: string,
  billProfile?: Record<string, string>,
) {
  await ensureTemplateCatalog();
  const targetLocale = normalizeLocale(locale);
  const normalizedProfile = normalizeBillProfile(billProfile);

  const template = await prisma.printTemplate.findFirst({
    where: { templateKey, isActive: true },
  });
  if (!template) {
    throw new ApiError(400, "Invalid print template key");
  }

  const existing = await prisma.businessSetting.findUnique({ where: { businessId } });
  const existingI18n =
    existing?.billProfileI18n &&
    typeof existing.billProfileI18n === "object" &&
    !Array.isArray(existing.billProfileI18n)
      ? (existing.billProfileI18n as Record<string, Prisma.JsonValue>)
      : {};

  const nextI18n: Prisma.InputJsonValue = {
    ...existingI18n,
    [targetLocale]: normalizedProfile,
  };

  await prisma.businessSetting.upsert({
    where: { businessId },
    create: {
      businessId,
      printTemplateKey: templateKey,
      billProfile: normalizedProfile,
      billProfileI18n: { [targetLocale]: normalizedProfile },
    },
    update: {
      printTemplateKey: templateKey,
      billProfile: normalizedProfile,
      billProfileI18n: nextI18n,
    },
  });

  return {
    templateKey,
    billProfile: normalizedProfile,
  };
}
