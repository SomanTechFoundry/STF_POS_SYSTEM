"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch, extractApiError } from "@/lib/client/api";
import { getStoredUser, type AuthUser } from "@/lib/client/auth";
import { getBusinessProfile } from "@/lib/client/format";
import { defaultBusinessProfileId, getBusinessProfileBase } from "@/lib/client/businessProfiles";

const currencyOptions = ["INR", "USD", "EUR", "GBP"];
const localeOptions = ["en-IN", "en-US", "ta-IN"];

const defaultBillProfile: Record<string, string> = {
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
  wholesalePaperSize: "A4",
};

export default function SettingsPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profileName, setProfileName] = useState(getBusinessProfileBase(defaultBusinessProfileId).name);
  const [currency, setCurrency] = useState("INR");
  const [locale, setLocale] = useState("en-IN");
  const [templateKey, setTemplateKey] = useState("classic_invoice");
  const [templates, setTemplates] = useState<Array<{ template_key: string; name: string; description?: string }>>([]);
  const [billProfile, setBillProfile] = useState({ ...defaultBillProfile });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setUser(getStoredUser());
    const profile = getBusinessProfile();
    setProfileName(profile.name);
    setCurrency(profile.currency);
    setLocale(profile.locale);

    let mounted = true;
    async function load() {
      try {
        const [current, list] = await Promise.all([
          apiFetch<{
            templateKey?: string;
            billProfile?: Record<string, string>;
          }>("/api/print-templates/current"),
          apiFetch<Array<{ template_key: string; name: string; description?: string }>>(
            "/api/print-templates",
          ).catch(() => []),
        ]);
        if (!mounted) return;
        setTemplateKey(current.templateKey || "classic_invoice");
        setBillProfile({ ...defaultBillProfile, ...(current.billProfile || {}) });
        setTemplates(list);
      } catch (err) {
        if (mounted) setError(extractApiError(err, "Failed to load print settings"));
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      localStorage.setItem(
        "businessProfileOverride",
        JSON.stringify({ currency, locale }),
      );
      localStorage.setItem("appLanguage", locale.startsWith("ta") ? "ta" : "en");

      await apiFetch("/api/print-templates/current", {
        method: "PUT",
        body: JSON.stringify({ templateKey, billProfile }),
      });
      setSuccess("Settings saved");
    } catch (err) {
      setError(extractApiError(err, "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">Settings</h2>
        <p className="page-subtitle">Display preferences and print template profile.</p>
      </div>

      {error && <p className="error-text">{error}</p>}
      {success && <p className="success-text">{success}</p>}

      <div className="card p-4">
        <h3 className="font-semibold text-slate-900">Business</h3>
        <p className="mt-2 text-sm text-slate-600">
          <span className="font-medium text-slate-800">{user?.businessName || "—"}</span>
          <span className="text-slate-400"> · </span>
          {profileName}
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSave}>
        <div className="card grid gap-4 p-4 sm:grid-cols-2">
          <div>
            <label className="label">Currency</label>
            <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {currencyOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Locale</label>
            <select className="input" value={locale} onChange={(e) => setLocale(e.target.value)}>
              {localeOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Print template</label>
            <select
              className="input"
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value)}
            >
              {(templates.length
                ? templates
                : [
                    { template_key: "classic_invoice", name: "Classic Invoice" },
                    { template_key: "modern_invoice", name: "Modern Invoice" },
                    { template_key: "thermal_80mm", name: "Thermal 80mm" },
                  ]
              ).map((item) => (
                <option key={item.template_key} value={item.template_key}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="card grid gap-3 p-4 sm:grid-cols-2">
          <h3 className="font-semibold text-slate-900 sm:col-span-2">Bill profile</h3>
          {(
            [
              ["businessName", "Business name"],
              ["businessDescription", "Description"],
              ["address", "Address"],
              ["city", "City"],
              ["gstin", "GSTIN"],
              ["tinNo", "TIN"],
              ["cstNo", "CST"],
              ["welNo", "WEL"],
              ["plNo", "PL"],
              ["slNo", "SL"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input
                className="input"
                value={billProfile[key] || ""}
                onChange={(e) =>
                  setBillProfile((prev) => ({ ...prev, [key]: e.target.value }))
                }
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <label className="label">Terms & conditions</label>
            <textarea
              className="input min-h-28"
              value={billProfile.termsAndConditions || ""}
              onChange={(e) =>
                setBillProfile((prev) => ({ ...prev, termsAndConditions: e.target.value }))
              }
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Disclaimer</label>
            <textarea
              className="input min-h-20"
              value={billProfile.disclaimer || ""}
              onChange={(e) =>
                setBillProfile((prev) => ({ ...prev, disclaimer: e.target.value }))
              }
            />
          </div>
        </div>

        <button type="submit" className="btn" disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </button>
      </form>
    </div>
  );
}
