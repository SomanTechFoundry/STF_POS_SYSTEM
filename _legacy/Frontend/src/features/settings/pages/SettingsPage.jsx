import { useEffect, useState } from "react";
import { extractApiError } from "../../../api/client";
import { fetchCurrentPrintTemplate, updateCurrentPrintTemplate } from "../../../api/printTemplateApi";
import { useI18n } from "../../../i18n/useI18n";
import { getBusinessProfile } from "../../../utils/formatters";
import { useAuthStore } from "../../../store/authStore";

const currencyOptions = ["INR", "USD", "EUR", "GBP"];
const localeOptions = ["en-IN", "en-US", "ta-IN"];

const defaultBillProfile = {
  businessName: "",
  businessDescription: "",
  address: "",
  city: "",
  tinNo: "",
  cstNo: "",
  welNo: "",
  plNo: "",
  slNo: "",
  gstin: "",
  termsAndConditions: "",
  disclaimer: "",
  wholesalePaperSize: "A4"
};

function SettingsPage() {
  const { t, setLanguage, language } = useI18n();
  const { user } = useAuthStore();
  const profile = getBusinessProfile();
  const [form, setForm] = useState({
    currency: profile.currency,
    locale: profile.locale
  });
  const [savedText, setSavedText] = useState("");
  const [error, setError] = useState("");
  const [printTemplateKey, setPrintTemplateKey] = useState("classic_invoice");
  const [billProfile, setBillProfile] = useState({ ...defaultBillProfile });

  useEffect(() => {
    let mounted = true;

    async function loadPrintTemplateConfig() {
      try {
        const current = await fetchCurrentPrintTemplate();

        if (!mounted) return;
        setPrintTemplateKey(current?.templateKey || "classic_invoice");
        setBillProfile({ ...defaultBillProfile, ...(current?.billProfile || {}) });
      } catch (err) {
        if (!mounted) return;
        setError(extractApiError(err, t("settings.failedLoadPrintProfile")));
      }
    }

    loadPrintTemplateConfig();
    return () => {
      mounted = false;
    };
  }, [language]);

  async function handleSave() {
    setError("");
    localStorage.setItem(
      "businessProfileOverride",
      JSON.stringify({
        currency: form.currency,
        locale: form.locale
      })
    );
    setLanguage(String(form.locale || "").startsWith("ta") ? "ta" : "en");

    try {
      await updateCurrentPrintTemplate(printTemplateKey, billProfile);
    } catch (err) {
      setError(extractApiError(err, t("settings.failedSavePrintProfile")));
      return;
    }

    setSavedText(t("settings.saved"));
  }

  function handleReset() {
    localStorage.removeItem("businessProfileOverride");
    setForm({
      currency: profile.currency,
      locale: profile.locale
    });
    setLanguage(String(profile.locale || "").startsWith("ta") ? "ta" : "en");
    setBillProfile({ ...defaultBillProfile });
    setSavedText(t("settings.resetDone"));
  }

  function patchBillProfile(field, value) {
    setBillProfile((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div>
      <h2>{t("settings.title")}</h2>
      <p className="muted">{t("settings.subtitle")}</p>

      <div className="settings-grid">
        <div className="card">
          <h3>{t("settings.profileInfo")}</h3>
          <p><strong>{t("settings.businessName")}:</strong> {user?.businessName || "-"}</p>
          <p><strong>{t("settings.businessProfile")}:</strong> {profile.name}</p>
          <p className="muted small">{t("settings.profileHint")}</p>
        </div>

        <div className="card">
          <h3>{t("settings.displaySettings")}</h3>
          <div className="form-grid">
            <select
              value={form.currency}
              onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value }))}
            >
              {currencyOptions.map((currency) => (
                <option key={currency} value={currency}>{currency}</option>
              ))}
            </select>
            <select
              value={form.locale}
              onChange={(event) => setForm((prev) => ({ ...prev, locale: event.target.value }))}
            >
              {localeOptions.map((locale) => (
                <option key={locale} value={locale}>{locale}</option>
              ))}
            </select>
          </div>
          <div className="settings-actions">
            <button type="button" className="ghost" onClick={handleReset}>{t("settings.reset")}</button>
            <button type="button" onClick={handleSave}>{t("settings.save")}</button>
          </div>
          {error && <p className="error-text">{error}</p>}
          {savedText && <p className="success-text">{savedText}</p>}
          <p className="muted small">{t("settings.localOnly")}</p>
        </div>
      </div>

      <div className="card section-gap">
        <h3>{t("settings.billProfile")}</h3>
        <p className="muted small">{t("settings.billProfileHint")}</p>

        <div className="bill-profile-form">
          <h4>{t("settings.licenseSection")}</h4>
          <div className="bill-profile-grid">
            <label className="bill-profile-field">
              <span>{t("bill.tinNo")}</span>
              <input placeholder={t("bill.enterTinNo")} value={billProfile.tinNo} onChange={(e) => patchBillProfile("tinNo", e.target.value)} />
            </label>
            <label className="bill-profile-field">
              <span>{t("bill.cstNo")}</span>
              <input placeholder={t("bill.enterCstNo")} value={billProfile.cstNo} onChange={(e) => patchBillProfile("cstNo", e.target.value)} />
            </label>
            <label className="bill-profile-field">
              <span>{t("bill.welNo")}</span>
              <input placeholder={t("bill.enterWelNo")} value={billProfile.welNo} onChange={(e) => patchBillProfile("welNo", e.target.value)} />
            </label>
            <label className="bill-profile-field">
              <span>{t("bill.plNo")}</span>
              <input placeholder={t("bill.enterPlNo")} value={billProfile.plNo} onChange={(e) => patchBillProfile("plNo", e.target.value)} />
            </label>
            <label className="bill-profile-field">
              <span>{t("bill.slNo")}</span>
              <input placeholder={t("bill.enterSlNo")} value={billProfile.slNo} onChange={(e) => patchBillProfile("slNo", e.target.value)} />
            </label>
            <label className="bill-profile-field">
              <span>{t("bill.gstin")}</span>
              <input placeholder={t("bill.enterGstin")} value={billProfile.gstin} onChange={(e) => patchBillProfile("gstin", e.target.value)} />
            </label>
          </div>

          <h4>{t("settings.addressSection")}</h4>
          <div className="bill-profile-grid">
            <label className="bill-profile-field">
              <span>{t("settings.businessName")}</span>
              <input placeholder={t("settings.enterBusinessName")} value={billProfile.businessName} onChange={(e) => patchBillProfile("businessName", e.target.value)} />
            </label>
            <label className="bill-profile-field">
              <span>{t("settings.businessDescription")}</span>
              <input placeholder={t("settings.enterBusinessDescription")} value={billProfile.businessDescription} onChange={(e) => patchBillProfile("businessDescription", e.target.value)} />
            </label>
            <label className="bill-profile-field">
              <span>{t("customers.address")}</span>
              <input placeholder={t("settings.enterAddress")} value={billProfile.address} onChange={(e) => patchBillProfile("address", e.target.value)} />
            </label>
            <label className="bill-profile-field">
              <span>{t("settings.city")}</span>
              <input placeholder={t("settings.enterCity")} value={billProfile.city} onChange={(e) => patchBillProfile("city", e.target.value)} />
            </label>
          </div>

          <h4>{t("settings.otherSection")}</h4>
          <label className="bill-profile-field full-width">
            <span>{t("settings.termsAndConditions")}</span>
            <textarea
              rows={4}
              placeholder={t("settings.enterTermsAndConditions")}
              value={billProfile.termsAndConditions}
              onChange={(e) => patchBillProfile("termsAndConditions", e.target.value)}
            />
          </label>
          <label className="bill-profile-field full-width">
            <span>{t("settings.disclaimer")}</span>
            <textarea
              rows={3}
              placeholder={t("settings.enterDisclaimer")}
              value={billProfile.disclaimer}
              onChange={(e) => patchBillProfile("disclaimer", e.target.value)}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
