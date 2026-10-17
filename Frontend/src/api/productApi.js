import api from "./client";

export async function fetchProducts() {
  const response = await api.get("/products");
  return response.data.data;
}

export async function fetchArchivedProducts() {
  const response = await api.get("/products/archived");
  return response.data.data;
}

export async function createProduct(payload) {
  const response = await api.post("/products", payload);
  return response.data.data;
}

export async function updateProduct(productId, payload) {
  const response = await api.patch(`/products/${productId}`, payload);
  return response.data.data;
}

export async function deleteProduct(productId) {
  const response = await api.delete(`/products/${productId}`);
  return response.data.data;
}

export async function restoreProduct(productId) {
  const response = await api.patch(`/products/${productId}/restore`);
  return response.data.data;
}
