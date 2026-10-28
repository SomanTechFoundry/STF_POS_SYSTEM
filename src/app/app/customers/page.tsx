"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch, extractApiError } from "@/lib/client/api";
import { canAccess, getStoredUser, type AuthUser } from "@/lib/client/auth";

type Customer = {
  id: string;
  name: string;
  address: string;
  mobile: string;
  email: string;
};

const emptyForm = { name: "", address: "", mobile: "", email: "" };

export default function CustomersPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const canManage = canAccess(user?.role, "customers");
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const data = await apiFetch<Array<Record<string, unknown>>>("/api/customers");
    setRows(
      data.map((item) => ({
        id: String(item.id),
        name: String(item.name || ""),
        address: String(item.address || ""),
        mobile: String(item.mobile || ""),
        email: String(item.email || ""),
      })),
    );
  }

  useEffect(() => {
    setUser(getStoredUser());
    let mounted = true;
    async function init() {
      try {
        await load();
      } catch (err) {
        if (mounted) setError(extractApiError(err, "Failed to load customers"));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void init();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(term) ||
        row.mobile.toLowerCase().includes(term) ||
        row.email.toLowerCase().includes(term),
    );
  }, [rows, search]);

  function startEdit(row: Customer) {
    setEditingId(row.id);
    setForm({
      name: row.name,
      address: row.address,
      mobile: row.mobile,
      email: row.email,
    });
  }

  function resetForm() {
    setEditingId("");
    setForm(emptyForm);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canManage) return;
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      if (editingId) {
        await apiFetch(`/api/customers/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(form),
        });
        setSuccess("Customer updated");
      } else {
        await apiFetch("/api/customers", {
          method: "POST",
          body: JSON.stringify(form),
        });
        setSuccess("Customer created");
      }
      resetForm();
      await load();
    } catch (err) {
      setError(extractApiError(err, "Save failed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function removeCustomer(id: string) {
    if (!canManage || !confirm("Delete this customer?")) return;
    try {
      await apiFetch(`/api/customers/${id}`, { method: "DELETE" });
      setSuccess("Customer deleted");
      await load();
    } catch (err) {
      setError(extractApiError(err, "Delete failed"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="page-title">Customers</h2>
          <p className="page-subtitle">Manage retail and wholesale customers.</p>
        </div>
        <input
          className="input w-full sm:w-56"
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <p className="error-text">{error}</p>}
      {success && <p className="success-text">{success}</p>}

      {canManage && (
        <form className="card grid gap-3 p-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <div className="sm:col-span-2 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">
              {editingId ? "Edit customer" : "New customer"}
            </h3>
            {editingId && (
              <button type="button" className="btn-ghost" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              required
              minLength={2}
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Mobile</label>
            <input
              className="input"
              value={form.mobile}
              onChange={(e) => setForm((prev) => ({ ...prev, mobile: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Address</label>
            <input
              className="input"
              value={form.address}
              onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? "Saving…" : editingId ? "Update" : "Create"}
            </button>
          </div>
        </form>
      )}

      <div className="card divide-y divide-slate-100">
        {loading ? (
          <p className="p-4 text-sm text-slate-500">Loading customers…</p>
        ) : (
          filtered.map((row) => (
            <div
              key={row.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-slate-900">{row.name}</p>
                <p className="text-sm text-slate-500">
                  {[row.mobile, row.email, row.address].filter(Boolean).join(" · ") || "No contact details"}
                </p>
              </div>
              {canManage && (
                <div className="flex gap-2">
                  <button type="button" className="btn-ghost" onClick={() => startEdit(row)}>
                    Edit
                  </button>
                  <button type="button" className="btn-danger" onClick={() => void removeCustomer(row.id)}>
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))
        )}
        {!loading && !filtered.length && (
          <p className="p-4 text-sm text-slate-500">No customers found.</p>
        )}
      </div>
    </div>
  );
}
