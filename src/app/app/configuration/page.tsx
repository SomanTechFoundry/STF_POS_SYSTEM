"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, extractApiError } from "@/lib/client/api";
import { getStoredUser, type AuthUser } from "@/lib/client/auth";

type UserRow = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  business_name: string;
  created_at?: string;
};

const roles = ["admin", "owner", "viewer"] as const;

export default function ConfigurationPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { role: string; isActive: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setCurrentUser(getStoredUser());
    let mounted = true;
    async function load() {
      try {
        const data = await apiFetch<UserRow[]>("/api/users");
        if (!mounted) return;
        setUsers(data);
        setDrafts(
          data.reduce<Record<string, { role: string; isActive: boolean }>>((acc, item) => {
            acc[item.id] = { role: item.role, isActive: item.is_active };
            return acc;
          }, {}),
        );
      } catch (err) {
        if (mounted) setError(extractApiError(err, "Failed to load users"));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      if (a.email === currentUser?.email) return -1;
      if (b.email === currentUser?.email) return 1;
      return String(b.created_at || "").localeCompare(String(a.created_at || ""));
    });
  }, [users, currentUser?.email]);

  async function handleSave(userId: string) {
    const draft = drafts[userId];
    if (!draft) return;
    setSavingId(userId);
    setError("");
    setSuccess("");
    try {
      const updated = await apiFetch<UserRow>(`/api/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role: draft.role, isActive: draft.isActive }),
      });
      setUsers((prev) => prev.map((item) => (item.id === userId ? { ...item, ...updated } : item)));
      setSuccess("User updated");
    } catch (err) {
      setError(extractApiError(err, "Failed to update user"));
    } finally {
      setSavingId("");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">Configuration</h2>
        <p className="page-subtitle">Admin user access controls.</p>
      </div>

      {error && <p className="error-text">{error}</p>}
      {success && <p className="success-text">{success}</p>}

      <div className="card divide-y divide-slate-100">
        {loading ? (
          <p className="p-4 text-sm text-slate-500">Loading users…</p>
        ) : (
          sortedUsers.map((row) => {
            const draft = drafts[row.id] || { role: row.role, isActive: row.is_active };
            const isSelf = row.email === currentUser?.email;
            return (
              <div
                key={row.id}
                className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">
                    {row.full_name}
                    {isSelf ? <span className="ml-2 text-xs font-medium text-emerald-700">you</span> : null}
                  </p>
                  <p className="truncate text-sm text-slate-500">
                    {row.email} · {row.business_name}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="input w-auto"
                    value={draft.role}
                    disabled={isSelf}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [row.id]: { ...draft, role: e.target.value },
                      }))
                    }
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={draft.isActive}
                      disabled={isSelf}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [row.id]: { ...draft, isActive: e.target.checked },
                        }))
                      }
                    />
                    Active
                  </label>
                  <button
                    type="button"
                    className="btn"
                    disabled={isSelf || savingId === row.id}
                    onClick={() => void handleSave(row.id)}
                  >
                    {savingId === row.id ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            );
          })
        )}
        {!loading && !sortedUsers.length && (
          <p className="p-4 text-sm text-slate-500">No users found.</p>
        )}
      </div>
    </div>
  );
}
