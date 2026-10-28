import { create } from "zustand";
import { loginRequest, registerRequest } from "../api/authApi";
import { defaultBusinessProfileId } from "../domain/businessProfiles";

function mapUser(apiUser) {
  return {
    id: apiUser.id,
    businessId: apiUser.business_id,
    businessName: apiUser.business_name,
    businessProfileId: apiUser.business_profile_id || defaultBusinessProfileId,
    name: apiUser.full_name,
    role: apiUser.role,
    email: apiUser.email
  };
}

function persistSession(data, set) {
  const mappedUser = mapUser(data.user);
  localStorage.setItem("accessToken", data.accessToken);
  localStorage.setItem("authUser", JSON.stringify(mappedUser));
  localStorage.setItem("businessProfileId", mappedUser.businessProfileId);
  set({ user: mappedUser });
}

export const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem("authUser") || "null"),
  login: async ({ email, password }) => {
    const data = await loginRequest({ email, password });
    persistSession(data, set);
  },
  register: async ({ businessName, businessProfileId, fullName, email, password }) => {
    return registerRequest({ businessName, businessProfileId, fullName, email, password });
  },
  logout: () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("authUser");
    set({ user: null });
  }
}));
