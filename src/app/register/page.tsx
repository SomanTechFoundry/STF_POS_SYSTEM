"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { apiFetch, extractApiError } from "@/lib/client/api";
import { isLoggedIn } from "@/lib/client/auth";
import { businessProfiles, defaultBusinessProfileId } from "@/lib/client/businessProfiles";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    businessName: "",
    businessProfileId: defaultBusinessProfileId,
    fullName: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isLoggedIn()) router.replace("/app");
  }, [router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const data = await apiFetch<{ message?: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setSuccess(data.message || "Signup submitted. Wait for admin approval.");
    } catch (err) {
      setError(extractApiError(err, "Registration failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="card w-full max-w-lg p-6 sm:p-8">
        <p className="text-sm font-semibold text-emerald-700">STF POS</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Register business</h1>
        <p className="mt-1 text-sm text-slate-500">
          Access is enabled after admin approval.
        </p>

        {error && <p className="error-text mt-4">{error}</p>}
        {success && <p className="success-text mt-4">{success}</p>}

        <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="businessName">
              Business name
            </label>
            <input
              id="businessName"
              className="input"
              required
              minLength={2}
              value={form.businessName}
              onChange={(e) => setForm((prev) => ({ ...prev, businessName: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="businessProfileId">
              Business profile
            </label>
            <select
              id="businessProfileId"
              className="input"
              value={form.businessProfileId}
              onChange={(e) => setForm((prev) => ({ ...prev, businessProfileId: e.target.value }))}
            >
              {Object.entries(businessProfiles).map(([id, profile]) => (
                <option key={id} value={id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="fullName">
              Full name
            </label>
            <input
              id="fullName"
              className="input"
              required
              minLength={2}
              value={form.fullName}
              onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className="input"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="input"
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn w-full" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit for approval"}
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already approved?{" "}
          <Link href="/login" className="font-medium text-emerald-700 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
