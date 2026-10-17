import { useEffect, useMemo, useState } from "react";
import { extractApiError } from "../../../api/client";
import { fetchProducts } from "../../../api/productApi";
import { useI18n } from "../../../i18n/useI18n";

function formatUnitLabel(unitSize, unitType) {
  if (!unitSize || (Number(unitSize) === 1 && unitType === "pcs")) return "pcs";
  return `${unitSize}${unitType}`;
}

const PAGE_SIZE = 5;
const MAIN_STORE_CODE = "main_store";
const GODOWN_CODE = "godown";

function getQtyByCode(locationStocks, code) {
  const row = (locationStocks || []).find((item) => item.location_code === code);
  return Number(row?.qty || 0);
}

function InventoryPage() {
  const { t, language } = useI18n();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState("product");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let mounted = true;

    async function loadInventory() {
      try {
        const data = await fetchProducts();
        if (!mounted) return;

        const flattened = data.flatMap((product) =>
          (product.variants || []).map((variant) => {
            const locationStocks = Array.isArray(variant.location_stocks) ? variant.location_stocks : [];
            const totalStock = Number(variant.stock_qty || 0);
            const hasLocationData = locationStocks.length > 0;
            const mainQty = hasLocationData ? getQtyByCode(locationStocks, MAIN_STORE_CODE) : totalStock;
            const godownQty = hasLocationData ? getQtyByCode(locationStocks, GODOWN_CODE) : 0;

            return {
              id: variant.id,
              sku: variant.sku,
              product: product.name,
              pack: formatUnitLabel(variant.unit_size, variant.unit_type),
              mainQty,
              godownQty,
              locationStock: `${mainQty} / ${godownQty}`,
              totalStock,
              reorderLevel: Number(variant.reorder_level || 0)
            };
          })
        );

        setRows(flattened);
      } catch (err) {
        if (mounted) {
          setError(extractApiError(err, t("inventory.failedLoad")));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadInventory();

    return () => {
      mounted = false;
    };
  }, [language]);

  const filteredSortedRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = term
      ? rows.filter((row) => (
          row.sku.toLowerCase().includes(term) ||
          row.product.toLowerCase().includes(term) ||
          String(row.pack).toLowerCase().includes(term)
        ))
      : rows;

    const sorted = [...filtered].sort((a, b) => {
      const numericKeys = new Set(["mainQty", "godownQty", "reorderLevel", "totalStock"]);
      if (numericKeys.has(sortKey)) {
        const aVal = Number(a[sortKey] || 0);
        const bVal = Number(b[sortKey] || 0);
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }

      const aVal = String(a[sortKey] || "");
      const bVal = String(b[sortKey] || "");
      return sortDir === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    });

    return sorted;
  }, [rows, searchTerm, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredSortedRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filteredSortedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDir("asc");
  }

  return (
    <div>
      <h2>{t("inventory.title")}</h2>
      <p className="muted">{t("inventory.subtitle")}</p>
      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p className="muted">{t("inventory.loading")}</p>
      ) : (
        <div className="card section-gap table-enhanced-wrap">
          <div className="table-toolbar">
            <input
              className="table-search"
              placeholder={t("inventory.searchPlaceholder")}
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setPage(1);
              }}
            />
            <p className="muted small">{t("inventory.showingRecords", { count: pagedRows.length, total: filteredSortedRows.length })}</p>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th><button type="button" className="table-sort-btn" onClick={() => handleSort("sku")}>{t("inventory.sku")}</button></th>
                  <th><button type="button" className="table-sort-btn" onClick={() => handleSort("product")}>{t("inventory.product")}</button></th>
                  <th><button type="button" className="table-sort-btn" onClick={() => handleSort("pack")}>{t("inventory.pack")}</button></th>
                  <th><button type="button" className="table-sort-btn" onClick={() => handleSort("mainQty")}>{t("inventory.stockSplit")}</button></th>
                  <th><button type="button" className="table-sort-btn" onClick={() => handleSort("totalStock")}>{t("inventory.totalStock")}</button></th>
                  <th><button type="button" className="table-sort-btn" onClick={() => handleSort("reorderLevel")}>{t("inventory.reorderLevel")}</button></th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.sku}</td>
                    <td>{row.product}</td>
                    <td>{row.pack}</td>
                    <td>{row.locationStock}</td>
                    <td>{row.totalStock}</td>
                    <td>{row.reorderLevel}</td>
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
      )}
    </div>
  );
}

export default InventoryPage;
