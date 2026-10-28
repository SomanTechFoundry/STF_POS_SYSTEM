import api from "./client";

export async function fetchCurrentPrintTemplate() {
  const response = await api.get("/print-templates/current");
  return response.data.data;
}

export async function updateCurrentPrintTemplate(templateKey, billProfile) {
  const payload = { templateKey };
  if (billProfile) payload.billProfile = billProfile;
  const response = await api.put("/print-templates/current", payload);
  return response.data.data;
}
