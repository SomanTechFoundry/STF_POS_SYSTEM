import api from "./client";

export async function fetchDashboardSummary(params = {}) {
  const cleanedParams = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== "" && value !== null && value !== undefined)
  );

  const response = await api.get("/dashboard/summary", { params: cleanedParams });
  return response.data.data;
}
