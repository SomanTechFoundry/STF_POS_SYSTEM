import api from "./client";

export async function loginRequest(payload) {
  const response = await api.post("/auth/login", payload);
  return response.data.data;
}

export async function registerRequest(payload) {
  const response = await api.post("/auth/register", payload);
  return response.data.data;
}
