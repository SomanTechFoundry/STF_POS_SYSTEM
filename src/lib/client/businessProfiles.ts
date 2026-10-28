export const defaultBusinessProfileId = "fertilizer";

export type ProductField = {
  key: string;
  label: string;
  required: boolean;
};

export type BusinessProfile = {
  name: string;
  currency: string;
  locale: string;
  productFields: ProductField[];
};

export const businessProfiles: Record<string, BusinessProfile> = {
  fertilizer: {
    name: "Fertilizer Business",
    currency: "INR",
    locale: "en-IN",
    productFields: [
      { key: "sku", label: "SKU", required: true },
      { key: "name", label: "Product Name", required: true },
      { key: "category", label: "Category", required: true },
      { key: "costPrice", label: "Cost Price", required: true },
      { key: "salePrice", label: "Sale Price", required: true },
      { key: "stockQty", label: "Stock Qty", required: true },
      { key: "reorderLevel", label: "Reorder Level", required: true },
    ],
  },
  paint: {
    name: "Paint Business",
    currency: "INR",
    locale: "en-IN",
    productFields: [
      { key: "sku", label: "SKU", required: true },
      { key: "name", label: "Product Name", required: true },
      { key: "category", label: "Category", required: true },
      { key: "costPrice", label: "Cost Price", required: true },
      { key: "salePrice", label: "Sale Price", required: true },
      { key: "stockQty", label: "Stock Qty", required: true },
      { key: "reorderLevel", label: "Reorder Level", required: true },
    ],
  },
};

export function getBusinessProfileBase(profileId: string | null | undefined): BusinessProfile {
  return businessProfiles[profileId || ""] || businessProfiles[defaultBusinessProfileId];
}
