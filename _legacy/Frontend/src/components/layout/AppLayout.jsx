import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { fetchBusinesses } from "../../api/userApi";
import { fetchCurrentPrintTemplate } from "../../api/printTemplateApi";
import { useAuthStore } from "../../store/authStore";
import { getBusinessProfile } from "../../utils/formatters";
import { canAccess, routeConfig } from "../../app/permissions";
import { useI18n } from "../../i18n/useI18n";

const IMPERSONATION_ID_KEY = "impersonationBusinessId";
const IMPERSONATION_NAME_KEY = "impersonationBusinessName";
const IMPERSONATION_PROFILE_KEY = "impersonationBusinessProfileId";
const COPYRIGHT_TEXT = `Copyright © ${new Date().getFullYear()} Soman Tech Foundry. All rights reserved.`;
const APP_BRAND_NAME = "SellthruBOS";
const APP_COMPANY_NAME = "STF - Soman Tech Foundry";

function AppLayout({ children }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const profile = getBusinessProfile();
  const allowedNavItems = routeConfig.filter((item) => canAccess(user?.role, item.moduleKey));
  const isAdmin = String(user?.role || "").toLowerCase() === "admin";

  const [menuOpen, setMenuOpen] = useState(false);
  const [now, setNow] = useState(new Date());
  const [billProfileInfo, setBillProfileInfo] = useState({ businessName: "", businessDescription: "" });
  const [businesses, setBusinesses] = useState([]);
  const [impersonationId, setImpersonationId] = useState(localStorage.getItem(IMPERSONATION_ID_KEY) || "");
  const [impersonationName, setImpersonationName] = useState(localStorage.getItem(IMPERSONATION_NAME_KEY) || "");
  const [impersonationProfileId, setImpersonationProfileId] = useState(localStorage.getItem(IMPERSONATION_PROFILE_KEY) || "");
  const menuRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadBranding() {
      try {
        const current = await fetchCurrentPrintTemplate();
        if (!active) return;
        const bp = current?.billProfile || {};
        setBillProfileInfo({
          businessName: String(bp.businessName || "").trim(),
          businessDescription: String(bp.businessDescription || "").trim()
        });
      } catch {
        if (!active) return;
        setBillProfileInfo({ businessName: "", businessDescription: "" });
      }
    }

    loadBranding();
    return () => {
      active = false;
    };
  }, [isAdmin, impersonationId]);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      window.addEventListener("mousedown", handleOutsideClick);
    }

    return () => {
      window.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!isAdmin) {
      localStorage.removeItem(IMPERSONATION_ID_KEY);
      localStorage.removeItem(IMPERSONATION_NAME_KEY);
      localStorage.removeItem(IMPERSONATION_PROFILE_KEY);
      setImpersonationId("");
      setImpersonationName("");
      setImpersonationProfileId("");
      return;
    }

    let active = true;
    async function loadBusinesses() {
      try {
        const data = await fetchBusinesses();
        if (!active) return;
        setBusinesses(data);

        if (!impersonationId && data.length > 0) {
          applyImpersonation(data[0], { refresh: true });
        }
      } catch {
        if (!active) return;
        setBusinesses([]);
      }
    }

    loadBusinesses();
    return () => {
      active = false;
    };
  }, [isAdmin]);

  const effectiveBusinessName = isAdmin && impersonationName ? impersonationName : (user?.businessName || profile.name);
  const topbarBusinessName = billProfileInfo.businessName || effectiveBusinessName;
  const topbarBusinessDescription = billProfileInfo.businessDescription || profile.name;

  const ownerName = user?.name || t("layout.userFallback");
  const ownerInitial = ownerName.charAt(0).toUpperCase();
  const businessInitials = effectiveBusinessName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  const dateText = useMemo(() => {
    return new Intl.DateTimeFormat(profile.locale || (language === "ta" ? "ta-IN" : "en-IN"), {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(now);
  }, [now, profile.locale, language]);
  const roleKey = `configuration.role_${String(user?.role || "").toLowerCase()}`;
  const roleLabel = user?.role ? (t(roleKey) === roleKey ? user.role : t(roleKey)) : "-";

  function applyImpersonation(business, options = {}) {
    if (!business?.business_id) return;

    localStorage.setItem(IMPERSONATION_ID_KEY, business.business_id);
    localStorage.setItem(IMPERSONATION_NAME_KEY, business.business_name || "");
    localStorage.setItem(IMPERSONATION_PROFILE_KEY, business.business_profile_id || "");

    if (business.business_profile_id) {
      localStorage.setItem("businessProfileId", business.business_profile_id);
    }

    setImpersonationId(business.business_id);
    setImpersonationName(business.business_name || "");
    setImpersonationProfileId(business.business_profile_id || "");

    if (options.refresh) {
      navigate(0);
    }
  }

  function handleBusinessChange(event) {
    const nextId = event.target.value;
    const selected = businesses.find((item) => item.business_id === nextId);
    if (selected) {
      applyImpersonation(selected, { refresh: true });
    }
  }

  function handleLogout() {
    logout();
    localStorage.removeItem(IMPERSONATION_ID_KEY);
    localStorage.removeItem(IMPERSONATION_NAME_KEY);
    localStorage.removeItem(IMPERSONATION_PROFILE_KEY);
    navigate("/");
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="app-brand-lockup">
            <h1 className="sbo-brand-title">{APP_BRAND_NAME}</h1>
            <span className="brand-chip sbo-brand-subtitle">{APP_COMPANY_NAME}</span>
          </div>
          <p className="muted small">{profile.name}</p>
        </div>

        <nav>
          {allowedNavItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "active" : "")}>{t(`nav.${item.labelKey}`)}</NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <p className="muted small">{t("layout.role")}</p>
          <strong>{roleLabel}</strong>
        </div>
      </aside>

      <main className="content">
        <header className="topbar card simple-topbar">
          <div className="topbar-fill">
            <div className="topbar-client-heading">
              <h2>{topbarBusinessName}</h2>
              <p className="topbar-client-description">{topbarBusinessDescription}</p>
            </div>

            <div className="topbar-brand-fill">
              <div className="brand-logo-mark">{businessInitials || "BS"}</div>
              <div className="brand-fill-text">
                <p className="brand-fill-kicker">{t("layout.businessWorkspace")}</p>
                <h3>{effectiveBusinessName}</h3>
              </div>
            </div>

            <div className="account-menu-wrap" ref={menuRef}>
              <button
                type="button"
                className="account-initial-btn"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-label={t("layout.openAccountMenu")}
              >
                {ownerInitial}
              </button>

              {menuOpen && (
                <div className="account-popover">
                  <p className="popover-label">{t("layout.loggedInUser")}</p>
                  <p className="popover-value">{ownerName.toUpperCase()}</p>

                  <p className="popover-label">{t("layout.business")}</p>
                  <p className="popover-value">{effectiveBusinessName.toUpperCase()}</p>

                  {isAdmin && (
                    <div className="popover-business-switch">
                      <label className="popover-label">{t("layout.switchBusiness")}</label>
                      <select value={impersonationId} onChange={handleBusinessChange}>
                        {businesses.map((item) => (
                          <option key={item.business_id} value={item.business_id}>
                            {item.business_name}
                          </option>
                        ))}
                      </select>
                      <p className="muted small">{t("layout.switchRefreshHint")}</p>
                    </div>
                  )}

                  <p className="popover-time">{dateText}</p>

                  <button type="button" className="ghost" onClick={handleLogout}>{t("layout.logout")}</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <section className="page-enter">{children}</section>
        <p className="app-copyright">{COPYRIGHT_TEXT}</p>
      </main>
    </div>
  );
}

export default AppLayout;
