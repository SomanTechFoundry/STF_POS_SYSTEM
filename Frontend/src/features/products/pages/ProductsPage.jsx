import { useEffect, useMemo, useState } from "react";
import { extractApiError } from "../../../api/client";
import {
  createProduct,
  deleteProduct,
  fetchArchivedProducts,
  fetchProducts,
  restoreProduct,
  updateProduct
} from "../../../api/productApi";
import { canAccess } from "../../../app/permissions";
import { useAuthStore } from "../../../store/authStore";
import { useI18n } from "../../../i18n/useI18n";

const UNIT_OPTIONS = [
  { value: "ml", label: "ml" },
  { value: "g", label: "g" },
  { value: "kg", label: "kg" },
  { value: "ltr", label: "ltr" },
  { value: "pcs", label: "pcs" }
];

const initialVariant = {
  id: "",
  sku: "",
  unitType: "pcs",
  unitSize: "1",
  costPrice: "",
  salePrice: "",
  stockQty: "",
  reorderLevel: ""
};

const initialForm = {
  name: "",
  category: "",
  variants: [{ ...initialVariant }]
};

const PAGE_SIZE = 5;

function formatUnitLabel(unitSize, unitType) {
  if (!unitSize || Number(unitSize) === 1 && unitType === "pcs") return "pcs";
  return `${unitSize}${unitType}`;
}

function ProductsPage() {
  const { user } = useAuthStore();
  const { t, language } = useI18n();
  const [rows, setRows] = useState([]);
  const [archivedRows, setArchivedRows] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [successText, setSuccessText] = useState("");
  const [nameMenuOpen, setNameMenuOpen] = useState(false);
  const [selectedExistingProductId, setSelectedExistingProductId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState(initialForm);
  const canManage = canAccess(user?.role, "products");

  function mapProduct(item) {
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      variants: (item.variants || []).map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        unitType: variant.unit_type || "pcs",
        unitSize: Number(variant.unit_size || 1),
        costPrice: Number(variant.cost_price || 0),
        salePrice: Number(variant.sale_price || 0),
        stockQty: Number(variant.stock_qty || 0),
        reorderLevel: Number(variant.reorder_level || 0)
      })),
      createdAt: item.created_at
    };
  }

  async function loadProducts() {
    const data = await fetchProducts();
    setRows(data.map(mapProduct));
  }

  async function loadArchivedProducts() {
    if (!canManage) return;
    const data = await fetchArchivedProducts();
    setArchivedRows(data.map(mapProduct));
  }

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        const [active, archived] = await Promise.all([
          fetchProducts(),
          canManage ? fetchArchivedProducts() : Promise.resolve([])
        ]);

        if (!mounted) return;

        setRows(active.map(mapProduct));
        setArchivedRows(archived.map(mapProduct));
      } catch (err) {
        if (mounted) setError(extractApiError(err, t("products.failedLoad")));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initialize();

    return () => {
      mounted = false;
    };
  }, [canManage, language]);

  const filteredSortedRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    const filtered = term
      ? rows.filter((row) => (
          row.name.toLowerCase().includes(term) ||
          row.category.toLowerCase().includes(term) ||
          row.variants.some((variant) => variant.sku.toLowerCase().includes(term))
        ))
      : rows;

    const sorted = [...filtered].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      return sortDir === "asc"
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });

    return sorted;
  }, [rows, searchTerm, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredSortedRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filteredSortedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const productNameMatches = useMemo(() => {
    const term = form.name.trim().toLowerCase();
    if (!term) return [];

    return rows
      .filter((row) => row.name.toLowerCase().includes(term))
      .slice(0, 6);
  }, [form.name, rows]);

  const selectedExistingProduct = useMemo(() => {
    return rows.find((row) => row.id === selectedExistingProductId) || null;
  }, [rows, selectedExistingProductId]);

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDir("asc");
  }

  function updateVariant(_formState, setFormState, index, field, value) {
    setFormState((prev) => ({
      ...prev,
      variants: prev.variants.map((variant, idx) => (
        idx === index ? { ...variant, [field]: value } : variant
      ))
    }));
  }

  function addVariant(_formState, setFormState) {
    setFormState((prev) => ({
      ...prev,
      variants: [...prev.variants, { ...initialVariant }]
    }));
  }

  function removeVariant(_formState, setFormState, index) {
    setFormState((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, idx) => idx !== index)
    }));
  }

  function handleNameChange(value) {
    setForm((prev) => ({ ...prev, name: value }));
    setNameMenuOpen(Boolean(value.trim()));

    const exact = rows.find((row) => row.name.trim().toLowerCase() === value.trim().toLowerCase());
    if (exact) {
      setSelectedExistingProductId(exact.id);
      setForm((prev) => ({ ...prev, category: exact.category }));
      return;
    }

    setSelectedExistingProductId("");
  }

  function selectExistingProduct(row) {
    setSelectedExistingProductId(row.id);
    setForm((prev) => ({ ...prev, name: row.name, category: row.category }));
    setNameMenuOpen(false);
  }

  async function handleCreateProduct(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccessText("");

    try {
      const normalizedName = form.name.trim().toLowerCase();
      const exactMatch = rows.find((row) => row.name.trim().toLowerCase() === normalizedName);
      const targetProduct = selectedExistingProduct || exactMatch;
      const incomingVariants = form.variants.map((variant) => ({
        sku: variant.sku,
        unitType: variant.unitType,
        unitSize: Number(variant.unitSize),
        costPrice: Number(variant.costPrice),
        salePrice: Number(variant.salePrice),
        stockQty: Number(variant.stockQty),
        reorderLevel: Number(variant.reorderLevel)
      }));

      if (targetProduct) {
        await updateProduct(targetProduct.id, {
          name: targetProduct.name,
          category: targetProduct.category,
          variants: [
            ...(targetProduct.variants || []).map((variant) => ({
              id: variant.id,
              sku: variant.sku,
              unitType: variant.unitType,
              unitSize: Number(variant.unitSize),
              costPrice: Number(variant.costPrice),
              salePrice: Number(variant.salePrice),
              stockQty: Number(variant.stockQty),
              reorderLevel: Number(variant.reorderLevel)
            })),
            ...incomingVariants
          ]
        });
        setSuccessText(t("products.variantAdded"));
      } else {
        await createProduct({
          name: form.name,
          category: form.category,
          variants: incomingVariants
        });
        setSuccessText(t("products.success"));
      }

      await Promise.all([loadProducts(), loadArchivedProducts()]);
      setForm(initialForm);
      setSelectedExistingProductId("");
      setNameMenuOpen(false);
    } catch (err) {
      setError(extractApiError(err, t("products.failedCreate")));
    } finally {
      setSubmitting(false);
    }
  }

  function beginEdit(row) {
    setEditingId(row.id);
    setEditForm({
      name: row.name,
      category: row.category,
      variants: row.variants.length
        ? row.variants.map((variant) => ({
            id: variant.id,
            sku: variant.sku,
            unitType: variant.unitType,
            unitSize: String(variant.unitSize || 1),
            costPrice: String(variant.costPrice),
            salePrice: String(variant.salePrice),
            stockQty: String(variant.stockQty),
            reorderLevel: String(variant.reorderLevel)
          }))
        : [{ ...initialVariant }]
    });
  }

  async function handleUpdateProduct(event) {
    event.preventDefault();
    if (!editingId) return;

    setSubmitting(true);
    setError("");
    setSuccessText("");

    try {
      await updateProduct(editingId, {
        name: editForm.name,
        category: editForm.category,
        variants: editForm.variants.map((variant) => ({
          id: variant.id || undefined,
          sku: variant.sku,
          unitType: variant.unitType,
          unitSize: Number(variant.unitSize),
          costPrice: Number(variant.costPrice),
          salePrice: Number(variant.salePrice),
          stockQty: Number(variant.stockQty),
          reorderLevel: Number(variant.reorderLevel)
        }))
      });

      await Promise.all([loadProducts(), loadArchivedProducts()]);
      setEditingId("");
      setEditForm(initialForm);
      setSuccessText(t("products.updated"));
    } catch (err) {
      setError(extractApiError(err, t("products.failedUpdate")));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteProduct(id) {
    if (!window.confirm(t("products.confirmDelete"))) return;

    setError("");
    setSuccessText("");

    try {
      await deleteProduct(id);
      await Promise.all([loadProducts(), loadArchivedProducts()]);
      setSuccessText(t("products.archived"));
    } catch (err) {
      setError(extractApiError(err, t("products.failedDelete")));
    }
  }

  async function handleRestoreProduct(id) {
    setError("");
    setSuccessText("");

    try {
      await restoreProduct(id);
      await Promise.all([loadProducts(), loadArchivedProducts()]);
      setSuccessText(t("products.restored"));
    } catch (err) {
      setError(extractApiError(err, t("products.failedRestore")));
    }
  }

  function renderVariantRows(formState, setFormState, allowRemove) {
    return formState.variants.map((variant, index) => (
      <div key={variant.id || index} className="variant-row">
        <input
          placeholder={t("products.skuLabel")}
          value={variant.sku}
          onChange={(e) => updateVariant(formState, setFormState, index, "sku", e.target.value)}
          required
        />
        <select
          value={variant.unitType}
          onChange={(e) => updateVariant(formState, setFormState, index, "unitType", e.target.value)}
        >
          {UNIT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <input
          type="number"
          placeholder={t("products.unitSize")}
          value={variant.unitSize}
          onChange={(e) => updateVariant(formState, setFormState, index, "unitSize", e.target.value)}
          required
        />
        <input
          type="number"
          placeholder={t("products.costPrice")}
          value={variant.costPrice}
          onChange={(e) => updateVariant(formState, setFormState, index, "costPrice", e.target.value)}
          required
        />
        <input
          type="number"
          placeholder={t("products.salePrice")}
          value={variant.salePrice}
          onChange={(e) => updateVariant(formState, setFormState, index, "salePrice", e.target.value)}
          required
        />
        <input
          type="number"
          placeholder={t("products.stockQty")}
          value={variant.stockQty}
          onChange={(e) => updateVariant(formState, setFormState, index, "stockQty", e.target.value)}
          required
        />
        <input
          type="number"
          placeholder={t("products.reorderLevel")}
          value={variant.reorderLevel}
          onChange={(e) => updateVariant(formState, setFormState, index, "reorderLevel", e.target.value)}
          required
        />
        {allowRemove && (
          <button type="button" className="ghost" onClick={() => removeVariant(formState, setFormState, index)}>{t("common.remove")}</button>
        )}
      </div>
    ));
  }

  return (
    <div>
      <h2>{t("products.title")}</h2>
      <p className="muted">{t("products.subtitle")}</p>

      {canManage && (
        <form className="card section-gap" onSubmit={handleCreateProduct}>
          <h3>{t("products.addProduct")}</h3>
          <div className="form-grid">
            <div className="combo-box">
              <input
                placeholder={t("products.productName")}
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                onFocus={() => setNameMenuOpen(Boolean(form.name.trim()))}
                onBlur={() => setTimeout(() => setNameMenuOpen(false), 120)}
                required
              />
              {nameMenuOpen && productNameMatches.length > 0 && (
                <div className="combo-menu">
                  {productNameMatches.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      className="combo-option"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        selectExistingProduct(row);
                      }}
                    >
                      <span className="combo-title">{row.name}</span>
                      <span className="combo-sub">{row.category} · {t("products.variantCount", { count: row.variants.length })}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input
              placeholder={t("products.category")}
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              required
              disabled={Boolean(selectedExistingProduct)}
            />
          </div>
          {selectedExistingProduct && <p className="muted small">{t("products.existingSelectedHint")}</p>}

          <div className="variant-block">
            <h4>{t("products.variants")}</h4>
            {renderVariantRows(form, setForm, form.variants.length > 1)}
            <button type="button" className="ghost" onClick={() => addVariant(form, setForm)}>{t("products.addVariant")}</button>
          </div>

          <div className="actions">
            <button type="submit" disabled={submitting}>{submitting ? t("products.saving") : t("products.createProduct")}</button>
          </div>
        </form>
      )}

      {canManage && editingId && (
        <form className="card section-gap" onSubmit={handleUpdateProduct}>
          <h3>{t("products.editProduct")}</h3>
          <div className="form-grid">
            <input placeholder={t("products.productName")} value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} required />
            <input placeholder={t("products.category")} value={editForm.category} onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))} required />
          </div>

          <div className="variant-block">
            <h4>{t("products.variants")}</h4>
            {renderVariantRows(editForm, setEditForm, editForm.variants.length > 1)}
            <button type="button" className="ghost" onClick={() => addVariant(editForm, setEditForm)}>{t("products.addVariant")}</button>
          </div>

          <div className="actions">
            <button type="button" className="ghost" onClick={() => setEditingId("")}>{t("common.cancel")}</button>
            <button type="submit" disabled={submitting}>{submitting ? t("products.saving") : t("products.updateProduct")}</button>
          </div>
        </form>
      )}

      {error && <p className="error-text">{error}</p>}
      {successText && <p className="success-text">{successText}</p>}

      {loading ? (
        <p className="muted">{t("products.loading")}</p>
      ) : (
        <>
          <div className="card section-gap table-enhanced-wrap">
            <div className="table-toolbar">
              <input
                className="table-search"
              placeholder={t("products.searchPlaceholder")}
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setPage(1);
                }}
              />
              <p className="muted small">{t("products.showingRecords", { count: pagedRows.length, total: filteredSortedRows.length })}</p>
            </div>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th><button type="button" className="table-sort-btn" onClick={() => handleSort("name")}>{t("products.productName")}</button></th>
                    <th><button type="button" className="table-sort-btn" onClick={() => handleSort("category")}>{t("products.category")}</button></th>
                    <th>{t("products.variants")}</th>
                    <th>{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.name}</strong>
                      </td>
                      <td>{row.category}</td>
                      <td>
                        <div className="variant-tags">
                          {row.variants.map((variant) => (
                            <span key={variant.id} className="variant-chip">
                              {variant.sku} · {formatUnitLabel(variant.unitSize, variant.unitType)} · {t("products.stockIn", { qty: variant.stockQty })}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        {canManage ? (
                          <div className="row-actions">
                            <button type="button" className="ghost" onClick={() => beginEdit(row)}>{t("common.edit")}</button>
                            <button type="button" className="ghost danger-ghost" onClick={() => handleDeleteProduct(row.id)}>{t("common.delete")}</button>
                          </div>
                        ) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination-row">
            <button type="button" className="ghost" disabled={currentPage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>{t("common.previous")}</button>
            <p className="small muted">{t("common.pageOf", { page: currentPage, total: totalPages })}</p>
            <button type="button" className="ghost" disabled={currentPage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>{t("common.next")}</button>
            </div>
          </div>

          {canManage && (
            <div className="card section-gap table-enhanced-wrap">
              <div className="table-toolbar">
                <h3>{t("products.archivedTitle", { count: archivedRows.length })}</h3>
                <button type="button" className="ghost" onClick={() => setShowArchived((prev) => !prev)}>
                  {showArchived ? t("products.hideArchived") : t("products.showArchived")}
                </button>
              </div>

              {showArchived && (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>{t("products.productName")}</th>
                        <th>{t("products.category")}</th>
                        <th>{t("products.variants")}</th>
                        <th>{t("common.action")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {archivedRows.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="muted">{t("products.noArchived")}</td>
                        </tr>
                      ) : (
                        archivedRows.map((row) => (
                          <tr key={row.id}>
                            <td>{row.name}</td>
                            <td>{row.category}</td>
                            <td>
                              <div className="variant-tags">
                                {row.variants.map((variant) => (
                                  <span key={variant.id} className="variant-chip">
                                    {variant.sku} · {formatUnitLabel(variant.unitSize, variant.unitType)}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td>
                              <button type="button" className="ghost" onClick={() => handleRestoreProduct(row.id)}>{t("products.restore")}</button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ProductsPage;
