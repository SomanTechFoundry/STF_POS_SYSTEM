"use client";

import { useEffect, useState } from "react";
import { apiFetch, extractApiError } from "@/lib/client/api";
import { formatCurrency } from "@/lib/client/format";

type DashboardSummary = {
  todaySales: string | number;
  billsCount: number;
  lowStockItems: number;
  avgBillValue: string | number;
  totalSales: string | number;
  totalProfit: string | number;
  profitMargin: number;
  totalInvoices: number;
  totalQtySold: number;
  dailyAverageSales: string | number;
  totalPurchaseSpend: string | number;
  recentBills?: Array<{
    id: string;
    bill_no: number;
    customer_name?: string | null;
    order_type?: string;
    net_total: number;
    created_at: string;
  }>;
  lowStockVariants?: Array<{
    productName: string;
    unitSize: number;
    unitType: string;
    stockQty: number;
  }>;
  salesProfitBreakdown?: {
    retailSales: number;
    wholesaleSales: number;
    retailProfit: number;
    wholesaleProfit: number;
  };
};

function toDateInputValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return toDateInputValue(d);
  });
  const [toDate, setToDate] = useState(() => toDateInputValue(new Date()));

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await apiFetch<DashboardSummary>("/api/dashboard/summary", {
          query: { fromDate, toDate },
        });
        if (mounted) setSummary(data);
      } catch (err) {
        if (mounted) setError(extractApiError(err, "Failed to load dashboard"));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [fromDate, toDate]);

  const stats = [
    { label: "Sales (range)", value: formatCurrency(summary?.todaySales) },
    { label: "Bills", value: String(summary?.billsCount ?? 0) },
    { label: "Avg bill", value: formatCurrency(summary?.avgBillValue) },
    { label: "Low stock", value: String(summary?.lowStockItems ?? 0) },
    { label: "Total sales", value: formatCurrency(summary?.totalSales) },
    { label: "Profit", value: formatCurrency(summary?.totalProfit) },
    { label: "Margin", value: `${Number(summary?.profitMargin || 0).toFixed(1)}%` },
    { label: "Purchases", value: formatCurrency(summary?.totalPurchaseSpend) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p className="page-subtitle">Sales, stock alerts, and recent bills.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            className="input w-auto"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <input
            type="date"
            className="input w-auto"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Loading summary…</p>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{stat.label}</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h3 className="font-semibold text-slate-900">Recent bills</h3>
          <div className="mt-3 divide-y divide-slate-100">
            {(summary?.recentBills || []).slice(0, 8).map((bill) => (
              <div key={bill.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">#{bill.bill_no}</p>
                  <p className="truncate text-slate-500">
                    {bill.customer_name || "Walk-in"} · {bill.order_type || "retail"}
                  </p>
                </div>
                <p className="shrink-0 font-medium text-slate-900">{formatCurrency(bill.net_total)}</p>
              </div>
            ))}
            {!loading && !(summary?.recentBills || []).length && (
              <p className="py-4 text-sm text-slate-500">No bills in this range.</p>
            )}
          </div>
        </section>

        <section className="card p-4">
          <h3 className="font-semibold text-slate-900">Low stock</h3>
          <div className="mt-3 divide-y divide-slate-100">
            {(summary?.lowStockVariants || []).slice(0, 8).map((item, index) => (
              <div key={`${item.productName}-${index}`} className="flex justify-between gap-3 py-2 text-sm">
                <p className="text-slate-800">
                  {item.productName}{" "}
                  <span className="text-slate-400">
                    ({item.unitSize}
                    {item.unitType})
                  </span>
                </p>
                <p className="font-medium text-rose-600">{item.stockQty}</p>
              </div>
            ))}
            {!loading && !(summary?.lowStockVariants || []).length && (
              <p className="py-4 text-sm text-slate-500">Stock levels look healthy.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
