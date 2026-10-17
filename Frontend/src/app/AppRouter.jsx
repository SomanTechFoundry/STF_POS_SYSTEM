import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import LoginPage from "../features/auth/pages/LoginPage";
import RegisterPage from "../features/auth/pages/RegisterPage";
import LandingPage from "../features/landing/pages/LandingPage";
import DashboardPage from "../features/dashboard/pages/DashboardPage";
import POSPage from "../features/sales/pages/POSPage";
import ProductsPage from "../features/products/pages/ProductsPage";
import InventoryPage from "../features/inventory/pages/InventoryPage";
import CustomersPage from "../features/customers/pages/CustomersPage";
import ReportsPage from "../features/reports/pages/ReportsPage";
import SettingsPage from "../features/settings/pages/SettingsPage";
import ConfigurationPage from "../features/configuration/pages/ConfigurationPage";
import { useAuthStore } from "../store/authStore";
import { canAccess } from "./permissions";
import { useI18n } from "../i18n/useI18n";

function UnauthorizedPage() {
  const { t } = useI18n();

  return (
    <div className="card">
      <h2>{t("router.accessDenied")}</h2>
      <p className="muted">{t("router.noPermission")}</p>
    </div>
  );
}

function RequireModuleAccess({ moduleKey, children }) {
  const { user } = useAuthStore();

  if (!canAccess(user?.role, moduleKey)) {
    return <Navigate to="/app/unauthorized" replace />;
  }

  return children;
}

function PrivateRoutes() {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;

  return (
    <AppLayout>
      <Routes>
        <Route index element={<RequireModuleAccess moduleKey="dashboard"><DashboardPage /></RequireModuleAccess>} />
        <Route path="pos" element={<RequireModuleAccess moduleKey="pos"><POSPage /></RequireModuleAccess>} />
        <Route path="products" element={<RequireModuleAccess moduleKey="products"><ProductsPage /></RequireModuleAccess>} />
        <Route path="inventory" element={<RequireModuleAccess moduleKey="inventory"><InventoryPage /></RequireModuleAccess>} />
        <Route path="customers" element={<RequireModuleAccess moduleKey="customers"><CustomersPage /></RequireModuleAccess>} />
        <Route path="reports" element={<RequireModuleAccess moduleKey="reports"><ReportsPage /></RequireModuleAccess>} />
        <Route path="settings" element={<RequireModuleAccess moduleKey="settings"><SettingsPage /></RequireModuleAccess>} />
        <Route path="configuration" element={<RequireModuleAccess moduleKey="configuration"><ConfigurationPage /></RequireModuleAccess>} />
        <Route path="unauthorized" element={<UnauthorizedPage />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </AppLayout>
  );
}

function AppRouter() {
  const { user } = useAuthStore();

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/app" replace /> : <LandingPage />} />
      <Route path="/login" element={user ? <Navigate to="/app" replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/app" replace /> : <RegisterPage />} />
      <Route path="/app/*" element={<PrivateRoutes />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRouter;
