import { prisma } from "@/lib/db/prisma";
import { getEnv } from "@/lib/env";
import { ApiError } from "@/lib/errors";
import { normalizeLocale, upsertEntityTranslations } from "@/lib/services/i18n.service";

const ALLOWED_ROLES = ["admin", "owner", "viewer"] as const;

const ENTITY_FIELD_MAP: Record<string, string[]> = {
  product: ["name", "category"],
  customer: ["name", "address"],
};

function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

function mapUser(row: {
  id: string;
  businessName: string;
  businessProfileId: string;
  businessId: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
}) {
  return {
    id: row.id,
    business_name: row.businessName,
    business_profile_id: row.businessProfileId,
    business_id: row.businessId,
    full_name: row.fullName,
    email: row.email,
    role: row.role,
    is_active: row.isActive,
    created_at: row.createdAt,
  };
}

export async function listUsers() {
  const rows = await prisma.appUser.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(mapUser);
}

export async function listBusinesses() {
  const rows = await prisma.appUser.groupBy({
    by: ["businessId", "businessName", "businessProfileId"],
    _min: { createdAt: true },
    orderBy: { businessName: "asc" },
  });

  return rows.map((row) => ({
    business_id: row.businessId,
    business_name: row.businessName,
    business_profile_id: row.businessProfileId,
    created_at: row._min.createdAt,
  }));
}

export async function updateUser(
  userId: string,
  payload: { role?: string; isActive?: boolean },
  actor: { userId: string },
) {
  const { role, isActive } = payload;

  if (role && !ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number])) {
    throw new ApiError(400, "Invalid role");
  }

  const target = await prisma.appUser.findUnique({ where: { id: userId } });
  if (!target) {
    throw new ApiError(404, "User not found");
  }

  const targetEmail = normalizeEmail(target.email);
  const adminEmail = normalizeEmail(getEnv().ADMIN_EMAIL);

  if (targetEmail === adminEmail) {
    if (role && role !== "admin") {
      throw new ApiError(400, "Configured admin account role cannot be changed");
    }
    if (isActive === false) {
      throw new ApiError(400, "Configured admin account cannot be disabled");
    }
  }

  if (actor.userId === userId && isActive === false) {
    throw new ApiError(400, "You cannot disable your own account");
  }

  const updated = await prisma.appUser.update({
    where: { id: userId },
    data: {
      role: role || target.role,
      isActive: typeof isActive === "boolean" ? isActive : target.isActive,
    },
  });

  return mapUser(updated);
}

function assertEntityType(entityType: string): "product" | "customer" {
  if (entityType === "product" || entityType === "customer") return entityType;
  throw new ApiError(400, "Invalid entity type");
}

export async function listTranslations(options: {
  businessId: string;
  entityType: string;
  locale: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const entityType = assertEntityType(options.entityType);
  const normalizedLocale = normalizeLocale(options.locale);
  const allowedFields = ENTITY_FIELD_MAP[entityType];
  const page = Math.max(1, Number(options.page || 1));
  const pageSize = Math.max(1, Number(options.pageSize || 5));
  const offset = (page - 1) * pageSize;
  const term = String(options.search || "").trim().toLowerCase();
  const businessId = options.businessId;

  const sourceExpression =
    entityType === "product"
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

  const table = entityType === "product" ? "product" : "customer";

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      entity_id: string;
      business_id: string;
      display_name: string;
      field_name: string;
      source_value: string;
      translated_value: string;
    }>
  >(
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
       WHERE e.business_id = $1::uuid
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
    businessId,
    allowedFields,
    normalizedLocale,
    entityType,
    term,
    pageSize,
    offset,
  );

  const countResult = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
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
       WHERE e.business_id = $1::uuid
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
    businessId,
    allowedFields,
    normalizedLocale,
    entityType,
    term,
  );

  return {
    rows,
    total: countResult[0]?.total || 0,
    page,
    pageSize,
  };
}

export async function updateTranslation(options: {
  businessId: string;
  entityType: string;
  entityId: string;
  fieldName: string;
  locale: string;
  value?: string;
}) {
  const entityType = assertEntityType(options.entityType);
  const allowedFields = ENTITY_FIELD_MAP[entityType];
  if (!allowedFields.includes(options.fieldName)) {
    throw new ApiError(400, "Invalid field name");
  }

  const entity =
    entityType === "product"
      ? await prisma.product.findUnique({ where: { id: options.entityId } })
      : await prisma.customer.findUnique({ where: { id: options.entityId } });

  if (!entity) {
    throw new ApiError(404, "Entity not found");
  }
  if (entity.businessId !== options.businessId) {
    throw new ApiError(403, "Entity does not belong to current business");
  }

  const normalizedLocale = normalizeLocale(options.locale);
  await upsertEntityTranslations(null, options.businessId, entityType, options.entityId, normalizedLocale, {
    [options.fieldName]: options.value || "",
  });

  const translation = await prisma.entityTranslation.findUnique({
    where: {
      businessId_entityType_entityId_fieldName_locale: {
        businessId: options.businessId,
        entityType,
        entityId: options.entityId,
        fieldName: options.fieldName,
        locale: normalizedLocale,
      },
    },
  });

  return {
    businessId: options.businessId,
    entityType,
    entityId: options.entityId,
    fieldName: options.fieldName,
    locale: normalizedLocale,
    value: translation?.value || "",
  };
}
