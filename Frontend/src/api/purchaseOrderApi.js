import api from "./client";

export async function fetchPurchaseOrders() {
  const response = await api.get("/purchase-orders");
  return response.data.data;
}

export async function createPurchaseOrder(payload) {
  const response = await api.post("/purchase-orders", payload);
  return response.data.data;
}

