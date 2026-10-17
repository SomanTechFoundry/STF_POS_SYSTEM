export const defaultBusinessProfileId = "fertilizer";

export const businessProfiles = {
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
      { key: "reorderLevel", label: "Reorder Level", required: true }
    ]
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
      { key: "reorderLevel", label: "Reorder Level", required: true }
    ]
  }
};
