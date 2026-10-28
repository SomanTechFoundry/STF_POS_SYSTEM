import { defaultBusinessProfileId, businessProfiles } from "../domain/businessProfiles";

export function getBusinessProfileBase(profileId) {
  return businessProfiles[profileId] || businessProfiles[defaultBusinessProfileId];
}

export function getBusinessProfile() {
  const storedId = localStorage.getItem("businessProfileId") || defaultBusinessProfileId;
  const baseProfile = getBusinessProfileBase(storedId);

  let overrides = {};
  try {
    overrides = JSON.parse(localStorage.getItem("businessProfileOverride") || "{}");
  } catch {
    overrides = {};
  }

  return {
    ...baseProfile,
    currency: overrides.currency || baseProfile.currency,
    locale: overrides.locale || baseProfile.locale
  };
}

export function formatCurrency(amount, currency = "INR", locale = "en-IN") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(amount || 0);
}
