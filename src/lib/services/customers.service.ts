import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/errors";
import { resolveEntityTranslations, upsertEntityTranslations } from "@/lib/services/i18n.service";

export type CustomerPayload = {
  name: string;
  address?: string;
  mobile?: string;
  email?: string;
};

function mapCustomer(row: {
  id: string;
  name: string;
  address: string;
  mobile: string;
  email: string;
  createdAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    mobile: row.mobile,
    email: row.email,
    created_at: row.createdAt,
  };
}

export async function listCustomers(businessId: string, locale: string) {
  const rows = await prisma.customer.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
  });

  const translations = await resolveEntityTranslations(
    null,
    businessId,
    "customer",
    rows.map((row) => row.id),
    ["name", "address"],
    locale,
  );

  return rows.map((row) => {
    const translated = translations.get(row.id) || {};
    const mapped = mapCustomer(row);
    return {
      ...mapped,
      name: translated.name || mapped.name,
      address: translated.address || mapped.address,
    };
  });
}

export async function createCustomer(businessId: string, payload: CustomerPayload, locale: string) {
  const created = await prisma.customer.create({
    data: {
      businessId,
      name: payload.name,
      address: payload.address || "",
      mobile: payload.mobile || "",
      email: payload.email || "",
    },
  });

  await upsertEntityTranslations(null, businessId, "customer", created.id, locale, {
    name: payload.name,
    address: payload.address || "",
  });

  return mapCustomer(created);
}

export async function updateCustomer(
  businessId: string,
  customerId: string,
  payload: CustomerPayload,
  locale: string,
) {
  const result = await prisma.customer.updateMany({
    where: { id: customerId, businessId },
    data: {
      name: payload.name,
      address: payload.address || "",
      mobile: payload.mobile || "",
      email: payload.email || "",
    },
  });

  if (result.count === 0) {
    throw new ApiError(404, "Customer not found");
  }

  const updated = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
  await upsertEntityTranslations(null, businessId, "customer", updated.id, locale, {
    name: payload.name,
    address: payload.address || "",
  });

  return mapCustomer(updated);
}

export async function deleteCustomer(businessId: string, customerId: string) {
  const result = await prisma.customer.deleteMany({
    where: { id: customerId, businessId },
  });

  if (result.count === 0) {
    throw new ApiError(404, "Customer not found");
  }

  return { id: customerId };
}
