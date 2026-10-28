import {
  defaultBusinessProfileId,
  getBusinessProfileBase,
  type BusinessProfile,
} from "@/lib/client/businessProfiles";

export function getBusinessProfile(): BusinessProfile {
  if (typeof window === "undefined") {
    return getBusinessProfileBase(defaultBusinessProfileId);
  }

  const storedId = localStorage.getItem("businessProfileId") || defaultBusinessProfileId;
  const baseProfile = getBusinessProfileBase(storedId);

  let overrides: Partial<BusinessProfile> = {};
  try {
    overrides = JSON.parse(localStorage.getItem("businessProfileOverride") || "{}");
  } catch {
    overrides = {};
  }

  return {
    ...baseProfile,
    currency: overrides.currency || baseProfile.currency,
    locale: overrides.locale || baseProfile.locale,
  };
}

export function formatCurrency(
  amount: number | string | null | undefined,
  currency?: string,
  locale?: string,
): string {
  const profile = typeof window !== "undefined" ? getBusinessProfile() : getBusinessProfileBase(defaultBusinessProfileId);
  return new Intl.NumberFormat(locale || profile.locale, {
    style: "currency",
    currency: currency || profile.currency,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

export const INVENTORY_LOCATIONS = [
  { code: "main_store", label: "Main Store" },
  { code: "godown", label: "Godown" },
] as const;

export function getLocationQty(
  locationStocks: Array<{ location_code?: string; qty?: number }> | undefined,
  code: string,
): number {
  const row = (locationStocks || []).find((item) => item.location_code === code);
  return Number(row?.qty || 0);
}

export function formatUnitLabel(unitSize: number, unitType: string): string {
  if (!unitSize || (Number(unitSize) === 1 && unitType === "pcs")) return "pcs";
  return `${unitSize}${unitType}`;
}
