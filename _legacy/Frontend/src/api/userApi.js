import api from "./client";

export async function fetchUsers() {
  const response = await api.get("/users");
  return response.data.data;
}

export async function fetchBusinesses() {
  const response = await api.get("/users/businesses");
  return response.data.data;
}

export async function updateUserAccess(userId, payload) {
  const response = await api.patch(`/users/${userId}`, payload);
  return response.data.data;
}

export async function fetchEntityTranslations(params) {
  const response = await api.get("/users/translations", { params });
  return response.data.data;
}

export async function updateEntityTranslation(payload) {
  const response = await api.patch("/users/translations/item", payload);
  return response.data.data;
}
