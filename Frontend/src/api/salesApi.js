import api from "./client";

export async function fetchSales() {
  const response = await api.get("/sales");
  return response.data.data;
}

export async function createSale(payload) {
  const response = await api.post("/sales", payload);
  return response.data.data;
}