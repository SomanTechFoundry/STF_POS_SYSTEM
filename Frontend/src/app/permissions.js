const ROLE_PERMISSIONS = {
  admin: ["dashboard", "pos", "products", "inventory", "customers", "reports", "settings", "configuration"],
  owner: ["dashboard", "pos", "products", "inventory", "customers", "reports", "settings"],
  viewer: ["dashboard", "reports"],
  cashier: ["dashboard", "reports"]
};

export function canAccess(role, moduleKey) {
  if (!role) return false;
  const normalizedRole = String(role).toLowerCase();
  const allowed = ROLE_PERMISSIONS[normalizedRole] || [];
  return allowed.includes(moduleKey);
}

export const routeConfig = [
  { to: "/app", labelKey: "dashboard", moduleKey: "dashboard" },
  { to: "/app/pos", labelKey: "pos", moduleKey: "pos" },
  { to: "/app/products", labelKey: "products", moduleKey: "products" },
  { to: "/app/inventory", labelKey: "inventory", moduleKey: "inventory" },
  { to: "/app/customers", labelKey: "customers", moduleKey: "customers" },
  { to: "/app/reports", labelKey: "reports", moduleKey: "reports" },
  { to: "/app/settings", labelKey: "settings", moduleKey: "settings" },
  { to: "/app/configuration", labelKey: "configuration", moduleKey: "configuration" }
];
