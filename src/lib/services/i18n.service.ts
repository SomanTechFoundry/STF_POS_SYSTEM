import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

const DEFAULT_LOCALE = "en-IN";

export function normalizeLocale(input: string | null | undefined): string {
  const raw = String(input || "").trim();
  if (!raw) return DEFAULT_LOCALE;
  const [langPart = "en", regionPart] = raw.replace("_", "-").split("-");
  const lang = langPart.toLowerCase();
  const region = regionPart ? regionPart.toUpperCase() : "IN";
  return `${lang}-${region}`;
}

export function getLocaleFallbacks(locale: string | null | undefined): string[] {
  const normalized = normalizeLocale(locale);
  const [lang] = normalized.split("-");
  return [normalized, lang];
}

export async function resolveEntityTranslations(
  db: Db | null,
  businessId: string,
  entityType: string,
  entityIds: string[],
  fields: string[],
  locale: string,
) {
  const client = db ?? prisma;
  const map = new Map<string, Record<string, string>>();
  if (!entityIds.length || !fields.length) return map;

  const locales = getLocaleFallbacks(locale);
  const rows = await client.entityTranslation.findMany({
    where: {
      businessId,
      entityType,
      entityId: { in: entityIds },
      fieldName: { in: fields },
      locale: { in: locales },
    },
  });

  const localeRank = new Map(locales.map((value, index) => [value, index]));
  const byEntity = new Map<string, Record<string, { value: string; rank: number }>>();

  for (const row of rows) {
    const rank = localeRank.get(row.locale) ?? 999;
    const current = byEntity.get(row.entityId) || {};
    const existing = current[row.fieldName];
    if (!existing || rank < existing.rank) {
      current[row.fieldName] = { value: row.value, rank };
      byEntity.set(row.entityId, current);
    }
  }

  for (const [entityId, fieldMap] of byEntity.entries()) {
    const output: Record<string, string> = {};
    for (const [fieldName, item] of Object.entries(fieldMap)) {
      output[fieldName] = item.value;
    }
    map.set(entityId, output);
  }
  return map;
}

export async function upsertEntityTranslations(
  db: Db | null,
  businessId: string,
  entityType: string,
  entityId: string,
  locale: string,
  values: Record<string, string | undefined | null>,
) {
  const client = db ?? prisma;
  const targetLocale = normalizeLocale(locale);

  for (const [fieldName, rawValue] of Object.entries(values)) {
    const value = String(rawValue ?? "").trim();
    if (!value) {
      await client.entityTranslation.deleteMany({
        where: {
          businessId,
          entityType,
          entityId,
          fieldName,
          locale: targetLocale,
        },
      });
      continue;
    }

    await client.entityTranslation.upsert({
      where: {
        businessId_entityType_entityId_fieldName_locale: {
          businessId,
          entityType,
          entityId,
          fieldName,
          locale: targetLocale,
        },
      },
      create: {
        businessId,
        entityType,
        entityId,
        fieldName,
        locale: targetLocale,
        value,
      },
      update: { value },
    });
  }
}
