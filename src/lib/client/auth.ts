import { defaultBusinessProfileId } from "@/lib/client/businessProfiles";

export type AuthUser = {
  id: string;
  businessId: string;
  businessName: string;
  businessProfileId: string;
  name: string;
  role: string;
  email: string;
};

export type ModuleKey =
  | "dashboard"
  | "pos"
  | "products"
  | "inventory"
  | "customers"
  | "reports"
  | "settings"
  | "configuration";

const ROLE_PERMISSIONS: Record<string, ModuleKey[]> = {
  admin: ["dashboard", "pos", "products", "inventory", "customers", "reports", "settings", "configuration"],
  owner: ["dashboard", "pos", "products", "inventory", "customers", "reports", "settings"],
  viewer: ["dashboard", "reports"],
  cashier: ["dashboard", "reports"],
};

export const routeConfig: Array<{ href: string; label: string; moduleKey: ModuleKey }> = [
  { href: "/app", label: "Dashboard", moduleKey: "dashboard" },
  { href: "/app/pos", label: "POS", moduleKey: "pos" },
  { href: "/app/products", label: "Products", moduleKey: "products" },
  { href: "/app/inventory", label: "Inventory", moduleKey: "inventory" },
  { href: "/app/customers", label: "Customers", moduleKey: "customers" },
  { href: "/app/reports", label: "Reports", moduleKey: "reports" },
  { href: "/app/settings", label: "Settings", moduleKey: "settings" },
  { href: "/app/configuration", label: "Configuration", moduleKey: "configuration" },
];

export function canAccess(role: string | null | undefined, moduleKey: ModuleKey): boolean {
  if (!role) return false;
  const normalizedRole = String(role).toLowerCase();
  const allowed = ROLE_PERMISSIONS[normalizedRole] || [];
  return allowed.includes(moduleKey);
}

export function mapApiUser(apiUser: Record<string, unknown>): AuthUser {
  return {
    id: String(apiUser.id || ""),
    businessId: String(apiUser.business_id || ""),
    businessName: String(apiUser.business_name || ""),
    businessProfileId: String(apiUser.business_profile_id || defaultBusinessProfileId),
    name: String(apiUser.full_name || ""),
    role: String(apiUser.role || ""),
    email: String(apiUser.email || ""),
  };
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("authUser");
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function persistSession(accessToken: string, apiUser: Record<string, unknown>): AuthUser {
  const user = mapApiUser(apiUser);
  localStorage.setItem("accessToken", accessToken);
  localStorage.setItem("authUser", JSON.stringify(user));
  localStorage.setItem("businessProfileId", user.businessProfileId);
  return user;
}

export function clearSession(): void {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("authUser");
  localStorage.removeItem("impersonationBusinessId");
  localStorage.removeItem("impersonationBusinessName");
  localStorage.removeItem("impersonationBusinessProfileId");
}

export function isLoggedIn(): boolean {
  return Boolean(getStoredToken() && getStoredUser());
}
