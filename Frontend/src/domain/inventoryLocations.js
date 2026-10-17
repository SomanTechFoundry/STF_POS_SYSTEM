export const INVENTORY_LOCATIONS = [
  { code: "main_store", labelKey: "inventory.mainStore" },
  { code: "godown", labelKey: "inventory.godown" }
];

export function getLocationQty(locationStocks, code) {
  const row = (locationStocks || []).find((item) => item.location_code === code);
  return Number(row?.qty || 0);
}

export function getLocationLabel(code, t) {
  const matched = INVENTORY_LOCATIONS.find((item) => item.code === code);
  if (!matched) return code;
  if (typeof t === "function") return t(matched.labelKey);
  return matched.labelKey;
}
