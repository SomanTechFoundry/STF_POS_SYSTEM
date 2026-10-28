"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, extractApiError } from "@/lib/client/api";
import { formatUnitLabel, INVENTORY_LOCATIONS } from "@/lib/client/format";

type StockRow = {
  productId: string;
  productName: string;
  category: string;
  variantId: string;
  sku: string;
  unitLabel: string;
  reorderLevel: number;
  totalStock: number;
  locations: Record<string, number>;
};

export default function InventoryPage() {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const products = await apiFetch<Array<Record<string, unknown>>>("/api/products");
        if (!mounted) return;

        const mapped: StockRow[] = [];
        products.forEach((product) => {
          ((product.variants as Array<Record<string, unknown>>) || []).forEach((variant) => {
            const locationStocks = Array.isArray(variant.location_stocks)
              ? (variant.location_stocks as Array<{ location_code?: string; qty?: number }>)
              : [];
            const locations: Record<string, number> = {};
            INVENTORY_LOCATIONS.forEach((loc) => {
              const match = locationStocks.find((item) => item.location_code === loc.code);
              locations[loc.code] = Number(match?.qty || 0);
            });
            mapped.push({
              productId: String(product.id),
              productName: String(product.name || ""),
              category: String(product.category || ""),
              variantId: String(variant.id),
              sku: String(variant.sku || ""),
              unitLabel: formatUnitLabel(Number(variant.unit_size || 1), String(variant.unit_type || "pcs")),
              reorderLevel: Number(variant.reorder_level || 0),
              totalStock: Number(variant.stock_qty || 0),
              locations,
            });
          });
        });
        setRows(mapped);
      } catch (err) {
        if (mounted) setError(extractApiError(err, "Failed to load inventory"));
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
      const matchesTerm =
        !term ||
        row.productName.toLowerCase().includes(term) ||
        row.sku.toLowerCase().includes(term) ||
        row.category.toLowerCase().includes(term);
      if (!matchesTerm) return false;
      if (locationFilter === "all") return true;
      return (row.locations[locationFilter] || 0) > 0;
    });
  }, [rows, search, locationFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="page-title">Inventory</h2>
          <p className="page-subtitle">Stock by location from active products.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="input w-full sm:w-56"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="input w-full sm:w-44"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
          >
            <option value="all">All locations</option>
            {INVENTORY_LOCATIONS.map((loc) => (
              <option key={loc.code} value={loc.code}>
                {loc.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="p-4 text-sm text-slate-500">Loading inventory…</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Unit</th>
                {INVENTORY_LOCATIONS.map((loc) => (
                  <th key={loc.code} className="px-4 py-3">
                    {loc.label}
                  </th>
                ))}
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Reorder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => {
                const low = row.totalStock <= row.reorderLevel;
                return (
                  <tr key={row.variantId} className={low ? "bg-rose-50/40" : undefined}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{row.productName}</p>
                      <p className="text-xs text-slate-500">{row.category}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.sku}</td>
                    <td className="px-4 py-3 text-slate-600">{row.unitLabel}</td>
                    {INVENTORY_LOCATIONS.map((loc) => (
                      <td key={loc.code} className="px-4 py-3 font-medium text-slate-800">
                        {row.locations[loc.code] || 0}
                      </td>
                    ))}
                    <td className="px-4 py-3 font-semibold text-slate-900">{row.totalStock}</td>
                    <td className="px-4 py-3 text-slate-600">{row.reorderLevel}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!loading && !filtered.length && (
          <p className="p-4 text-sm text-slate-500">No stock rows found.</p>
        )}
      </div>
    </div>
  );
}
