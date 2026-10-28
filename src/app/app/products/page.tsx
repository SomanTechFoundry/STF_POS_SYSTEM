"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch, extractApiError } from "@/lib/client/api";
import { canAccess, getStoredUser, type AuthUser } from "@/lib/client/auth";
import { formatCurrency, formatUnitLabel } from "@/lib/client/format";

type VariantForm = {
  id?: string;
  sku: string;
  unitType: "ml" | "g" | "kg" | "ltr" | "pcs";
  unitSize: string;
  costPrice: string;
  salePrice: string;
  stockQty: string;
  reorderLevel: string;
};

type ProductRow = {
  id: string;
  name: string;
  category: string;
  variants: Array<{
    id: string;
    sku: string;
    unitType: string;
    unitSize: number;
    costPrice: number;
    salePrice: number;
    stockQty: number;
    reorderLevel: number;
  }>;
};

const emptyVariant = (): VariantForm => ({
  sku: "",
  unitType: "pcs",
  unitSize: "1",
  costPrice: "0",
  salePrice: "",
  stockQty: "0",
  reorderLevel: "0",
});

function mapProduct(item: Record<string, unknown>): ProductRow {
  return {
    id: String(item.id),
    name: String(item.name || ""),
    category: String(item.category || ""),
    variants: ((item.variants as Array<Record<string, unknown>>) || []).map((variant) => ({
      id: String(variant.id),
      sku: String(variant.sku || ""),
      unitType: String(variant.unit_type || "pcs"),
      unitSize: Number(variant.unit_size || 1),
      costPrice: Number(variant.cost_price || 0),
      salePrice: Number(variant.sale_price || 0),
      stockQty: Number(variant.stock_qty || 0),
      reorderLevel: Number(variant.reorder_level || 0),
    })),
  };
}

function toPayload(name: string, category: string, variants: VariantForm[]) {
  return {
    name,
    category,
    variants: variants.map((variant) => ({
      ...(variant.id ? { id: variant.id } : {}),
      sku: variant.sku.trim(),
      unitType: variant.unitType,
      unitSize: Number(variant.unitSize) || 1,
      costPrice: Number(variant.costPrice) || 0,
      salePrice: Number(variant.salePrice) || 0,
      stockQty: Number(variant.stockQty) || 0,
      reorderLevel: Number(variant.reorderLevel) || 0,
    })),
  };
}

export default function ProductsPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const canManage = canAccess(user?.role, "products");
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [archived, setArchived] = useState<ProductRow[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState({ name: "", category: "", variants: [emptyVariant()] });
  const [submitting, setSubmitting] = useState(false);

  async function load(manage?: boolean) {
    const allowArchived = manage ?? canAccess(getStoredUser()?.role, "products");
    const [active, archivedData] = await Promise.all([
      apiFetch<Array<Record<string, unknown>>>("/api/products"),
      allowArchived
        ? apiFetch<Array<Record<string, unknown>>>("/api/products/archived").catch(() => [])
        : Promise.resolve([]),
    ]);
    setRows(active.map(mapProduct));
    setArchived(archivedData.map(mapProduct));
  }

  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);
    let mounted = true;
    async function init() {
      try {
        await load(canAccess(stored?.role, "products"));
      } catch (err) {
        if (mounted) setError(extractApiError(err, "Failed to load products"));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void init();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const source = showArchived ? archived : rows;
    if (!term) return source;
    return source.filter(
      (row) =>
        row.name.toLowerCase().includes(term) ||
        row.category.toLowerCase().includes(term) ||
        row.variants.some((v) => v.sku.toLowerCase().includes(term)),
    );
  }, [rows, archived, search, showArchived]);

  function resetForm() {
    setEditingId("");
    setForm({ name: "", category: "", variants: [emptyVariant()] });
  }

  function startEdit(row: ProductRow) {
    setEditingId(row.id);
    setShowArchived(false);
    setForm({
      name: row.name,
      category: row.category,
      variants: row.variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        unitType: (variant.unitType as VariantForm["unitType"]) || "pcs",
        unitSize: String(variant.unitSize),
        costPrice: String(variant.costPrice),
        salePrice: String(variant.salePrice),
        stockQty: String(variant.stockQty),
        reorderLevel: String(variant.reorderLevel),
      })),
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canManage) return;
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const payload = toPayload(form.name, form.category, form.variants);
      if (editingId) {
        await apiFetch(`/api/products/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setSuccess("Product updated");
      } else {
        await apiFetch("/api/products", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSuccess("Product created");
      }
      resetForm();
      await load();
    } catch (err) {
      setError(extractApiError(err, "Save failed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function archiveProduct(id: string) {
    if (!canManage || !confirm("Archive this product?")) return;
    try {
      await apiFetch(`/api/products/${id}`, { method: "DELETE" });
      setSuccess("Product archived");
      await load();
    } catch (err) {
      setError(extractApiError(err, "Archive failed"));
    }
  }

  async function restoreProduct(id: string) {
    if (!canManage) return;
    try {
      await apiFetch(`/api/products/${id}/restore`, { method: "PATCH" });
      setSuccess("Product restored");
      await load();
    } catch (err) {
      setError(extractApiError(err, "Restore failed"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="page-title">Products</h2>
          <p className="page-subtitle">Create, edit, and archive catalog items.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="input w-full sm:w-56"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {canManage && (
            <button type="button" className="btn-ghost" onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? "Show active" : "Show archived"}
            </button>
          )}
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {success && <p className="success-text">{success}</p>}

      {canManage && !showArchived && (
        <form className="card space-y-4 p-4" onSubmit={handleSubmit}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-900">
              {editingId ? "Edit product" : "New product"}
            </h3>
            {editingId && (
              <button type="button" className="btn-ghost" onClick={resetForm}>
                Cancel edit
              </button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Name</label>
              <input
                className="input"
                required
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Category</label>
              <input
                className="input"
                required
                value={form.category}
                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-3">
            {form.variants.map((variant, index) => (
              <div key={index} className="grid gap-2 rounded-lg border border-slate-100 p-3 sm:grid-cols-3 lg:grid-cols-7">
                <div>
                  <label className="label">SKU</label>
                  <input
                    className="input"
                    required
                    value={variant.sku}
                    onChange={(e) =>
                      setForm((prev) => {
                        const variants = [...prev.variants];
                        variants[index] = { ...variants[index], sku: e.target.value };
                        return { ...prev, variants };
                      })
                    }
                  />
                </div>
                <div>
                  <label className="label">Unit</label>
                  <select
                    className="input"
                    value={variant.unitType}
                    onChange={(e) =>
                      setForm((prev) => {
                        const variants = [...prev.variants];
                        variants[index] = {
                          ...variants[index],
                          unitType: e.target.value as VariantForm["unitType"],
                        };
                        return { ...prev, variants };
                      })
                    }
                  >
                    {["pcs", "kg", "g", "ltr", "ml"].map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Size</label>
                  <input
                    className="input"
                    type="number"
                    min={0.001}
                    step="any"
                    value={variant.unitSize}
                    onChange={(e) =>
                      setForm((prev) => {
                        const variants = [...prev.variants];
                        variants[index] = { ...variants[index], unitSize: e.target.value };
                        return { ...prev, variants };
                      })
                    }
                  />
                </div>
                <div>
                  <label className="label">Cost</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    step="any"
                    value={variant.costPrice}
                    onChange={(e) =>
                      setForm((prev) => {
                        const variants = [...prev.variants];
                        variants[index] = { ...variants[index], costPrice: e.target.value };
                        return { ...prev, variants };
                      })
                    }
                  />
                </div>
                <div>
                  <label className="label">Sale</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    step="any"
                    required
                    value={variant.salePrice}
                    onChange={(e) =>
                      setForm((prev) => {
                        const variants = [...prev.variants];
                        variants[index] = { ...variants[index], salePrice: e.target.value };
                        return { ...prev, variants };
                      })
                    }
                  />
                </div>
                <div>
                  <label className="label">Stock</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={variant.stockQty}
                    onChange={(e) =>
                      setForm((prev) => {
                        const variants = [...prev.variants];
                        variants[index] = { ...variants[index], stockQty: e.target.value };
                        return { ...prev, variants };
                      })
                    }
                  />
                </div>
                <div>
                  <label className="label">Reorder</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={variant.reorderLevel}
                    onChange={(e) =>
                      setForm((prev) => {
                        const variants = [...prev.variants];
                        variants[index] = { ...variants[index], reorderLevel: e.target.value };
                        return { ...prev, variants };
                      })
                    }
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setForm((prev) => ({ ...prev, variants: [...prev.variants, emptyVariant()] }))}
            >
              Add variant
            </button>
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? "Saving…" : editingId ? "Update product" : "Create product"}
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <p className="p-4 text-sm text-slate-500">Loading products…</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((row) => (
              <div key={row.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{row.name}</p>
                  <p className="text-sm text-slate-500">{row.category}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {row.variants.map((variant) => (
                      <span
                        key={variant.id}
                        className="rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600"
                      >
                        {variant.sku} · {formatUnitLabel(variant.unitSize, variant.unitType)} ·{" "}
                        {formatCurrency(variant.salePrice)} · stock {variant.stockQty}
                      </span>
                    ))}
                  </div>
                </div>
                {canManage && (
                  <div className="flex shrink-0 gap-2">
                    {showArchived ? (
                      <button type="button" className="btn-ghost" onClick={() => void restoreProduct(row.id)}>
                        Restore
                      </button>
                    ) : (
                      <>
                        <button type="button" className="btn-ghost" onClick={() => startEdit(row)}>
                          Edit
                        </button>
                        <button type="button" className="btn-danger" onClick={() => void archiveProduct(row.id)}>
                          Archive
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
            {!filtered.length && <p className="p-4 text-sm text-slate-500">No products found.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
