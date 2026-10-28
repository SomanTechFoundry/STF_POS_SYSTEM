"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, extractApiError } from "@/lib/client/api";
import { formatCurrency } from "@/lib/client/format";

type SaleRow = {
  id: string;
  bill_no: number;
  order_type: string;
  payment_mode: string;
  net_total: number;
  created_at: string;
  customer_name?: string | null;
};

export default function ReportsPage() {
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [orderType, setOrderType] = useState("all");

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const data = await apiFetch<SaleRow[]>("/api/sales");
        if (mounted) setRows(data);
      } catch (err) {
        if (mounted) setError(extractApiError(err, "Failed to load sales"));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesType = orderType === "all" || row.order_type === orderType;
      const matchesTerm =
        !term ||
        String(row.bill_no).includes(term) ||
        String(row.customer_name || "").toLowerCase().includes(term) ||
        row.payment_mode.toLowerCase().includes(term);
      return matchesType && matchesTerm;
    });
  }, [rows, search, orderType]);

  const total = filtered.reduce((sum, row) => sum + Number(row.net_total || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="page-title">Reports</h2>
          <p className="page-subtitle">Recent sales list with filters.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="input w-full sm:w-48"
            placeholder="Search bill / customer"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="input w-full sm:w-40"
            value={orderType}
            onChange={(e) => setOrderType(e.target.value)}
          >
            <option value="all">All types</option>
            <option value="retail">Retail</option>
            <option value="wholesale">Wholesale</option>
          </select>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Filtered total</p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCurrency(total)}</p>
        <p className="text-sm text-slate-500">{filtered.length} bills</p>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="p-4 text-sm text-slate-500">Loading sales…</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Bill</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">#{row.bill_no}</td>
                  <td className="px-4 py-3 text-slate-600">{row.customer_name || "Walk-in"}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{row.order_type}</td>
                  <td className="px-4 py-3 uppercase text-slate-600">{row.payment_mode}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {formatCurrency(row.net_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && !filtered.length && (
          <p className="p-4 text-sm text-slate-500">No sales found.</p>
        )}
      </div>
    </div>
  );
}
