import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { extractApiError } from "../../../api/client";
import { useI18n } from "../../../i18n/useI18n";
import { useAuthStore } from "../../../store/authStore";

const COPYRIGHT_TEXT = `Copyright © ${new Date().getFullYear()} Soman Tech Foundry. All rights reserved.`;
const APP_BRAND_NAME = "SellthruBOS";
const APP_COMPANY_NAME = "STF - Soman Tech Foundry";

function LoginPage() {
  const { login } = useAuthStore();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "", password: "" });

  const approvedMessage = useMemo(() => {
    return searchParams.get("approved") === "1" ? t("auth.approvedMessage") : "";
  }, [searchParams, t]);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await login(form);
      navigate("/app");
    } catch (err) {
      setError(extractApiError(err, t("auth.loginFailed")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="landing-page sbo-landing auth-screen">
      <header className="landing-header sbo-header sbo-header-minimal">
        <div className="sbo-header-inner">
          <div className="sbo-header-left">
            <Link to="/" className="landing-brand sbo-brand-link" aria-label="Go to home page">
              <h1 className="sbo-brand-title">{APP_BRAND_NAME}</h1>
              <span className="brand-chip sbo-brand-subtitle">{APP_COMPANY_NAME}</span>
            </Link>
          </div>
          <div className="landing-auth-actions sbo-header-auth">
            <Link to="/login" className="landing-link-btn outline">{t("auth.signIn")}</Link>
            <Link to="/register" className="landing-link-btn primary">{t("auth.createOwner")}</Link>
          </div>
        </div>
      </header>

      <main className="auth-main">
        <form className="card auth-form-card" onSubmit={handleSubmit}>
          <h2>{t("auth.loginTitle")}</h2>
          <p className="muted">{t("auth.loginSubtitle")}</p>
          {approvedMessage && <p className="success-text">{approvedMessage}</p>}
          <label>{t("auth.email")}</label>
          <input
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            required
            type="email"
          />
          <label>{t("auth.password")}</label>
          <input
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            required
            type="password"
          />
          {error && <p className="error-text">{error}</p>}
          <button type="submit" disabled={loading}>{loading ? t("auth.signingIn") : t("auth.signIn")}</button>
          <p className="auth-switch">{t("auth.newBusiness")} <Link to="/register">{t("auth.createOwner")}</Link></p>
          <p className="app-copyright auth-copy">{COPYRIGHT_TEXT}</p>
        </form>
      </main>
    </div>
  );
}

export default LoginPage;
