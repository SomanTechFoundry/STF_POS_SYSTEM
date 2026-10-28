import { useEffect, useMemo, useRef, useState } from "react";
import { fetchDashboardSummary } from "../../../api/dashboardApi";
import { extractApiError } from "../../../api/client";
import StatCard from "../../../components/ui/StatCard";
import { useI18n } from "../../../i18n/useI18n";
import { formatCurrency, getBusinessProfile } from "../../../utils/formatters";

const PAGE_SIZE = 5;

function toDateInputValue(date) {
  return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 10);
}

function getQuickRange(fromDate, toDate) {
  if (!fromDate && !toDate) return "all";

  const today = new Date();
  const todayText = toDateInputValue(today);

  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const thisMonthText = toDateInputValue(thisMonthStart);
  if (fromDate === thisMonthText && toDate === todayText) return "thisMonth";

  const last7Start = new Date(today);
  last7Start.setDate(today.getDate() - 6);
  const last7Text = toDateInputValue(last7Start);
  if (fromDate === last7Text && toDate === todayText) return "last7";

  if (fromDate === todayText && toDate === todayText) return "today";

  return "custom";
}

function formatMetric(value, formatter) {
  if (value === null || value === undefined) return "--";
  return formatter ? formatter(value) : String(value);
}

function formatQuantity(value) {
  const numeric = Number(value || 0);
  if (Number.isNaN(numeric)) return "0";
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2).replace(/\.?0+$/, "");
}

function formatPackLabel(unitSize, unitType) {
  if (!unitSize && !unitType) return "";
  return `${unitSize || ""}${unitType || ""}`.trim();
}

function DashboardPage() {
  const profile = getBusinessProfile();
  const { t, language } = useI18n();
  const filterRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [appliedFromDate, setAppliedFromDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return toDateInputValue(date);
  });
  const [appliedToDate, setAppliedToDate] = useState(() => toDateInputValue(new Date()));
  const [draftFromDate, setDraftFromDate] = useState(appliedFromDate);
  const [draftToDate, setDraftToDate] = useState(appliedToDate);

  useEffect(() => {
    function handleClickOutside(event) {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setDraftFromDate(appliedFromDate);
        setDraftToDate(appliedToDate);
        setIsFilterOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [appliedFromDate, appliedToDate, language]);

  useEffect(() => {
    let mounted = true;

    async function loadSummary() {
      setLoading(true);
      setError("");
      try {
        if (appliedFromDate && appliedToDate && appliedFromDate > appliedToDate) {
          throw new Error(t("dashboard.invalidDateRange"));
        }

        const data = await fetchDashboardSummary({ fromDate: appliedFromDate, toDate: appliedToDate });
        if (mounted) {
          setSummary(data);
          setPage(1);
        }
      } catch (err) {
        if (mounted) {
          setError(extractApiError(err, t("dashboard.failedLoad")));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadSummary();

    return () => {
      mounted = false;
    };
  }, [appliedFromDate, appliedToDate, language]);

  const billColumns = useMemo(() => ([
    { key: "billNo", label: t("dashboard.billNo") },
    { key: "billType", label: t("dashboard.billType") },
    { key: "dateTime", label: t("dashboard.dateTime") },
    { key: "customer", label: t("dashboard.customerSupplier") },
    { key: "paymentMode", label: t("dashboard.payment") },
    { key: "gross", label: t("dashboard.gross") },
    { key: "discount", label: t("dashboard.discount") },
    { key: "net", label: t("dashboard.netTotal") },
    { key: "createdBy", label: t("dashboard.createdBy") }
  ]), [t]);

  const billRows = useMemo(() => {
    if (!summary?.recentBills) return [];

    return summary.recentBills.map((item) => ({
      id: `${item.bill_type}-${item.id}`,
      billNo: `#${item.bill_no}`,
      billTypeKey: String(item.bill_type || "retail_order"),
      billType: t(`billType.${String(item.bill_type || "retail_order")}`),
      createdAt: item.created_at,
      dateTime: new Date(item.created_at).toLocaleString(profile.locale),
      customer: item.customer_name || "-",
      paymentMode: t(`payment.${String(item.payment_mode || "").toLowerCase()}`) !== `payment.${String(item.payment_mode || "").toLowerCase()}`
        ? t(`payment.${String(item.payment_mode || "").toLowerCase()}`)
        : String(item.payment_mode || "-").toUpperCase(),
      grossValue: Number(item.gross_total),
      discountValue: Number(item.discount),
      netValue: Number(item.net_total),
      gross: formatCurrency(Number(item.gross_total), profile.currency, profile.locale),
      discount: formatCurrency(Number(item.discount), profile.currency, profile.locale),
      net: formatCurrency(Number(item.net_total), profile.currency, profile.locale),
      createdBy: item.created_by
    }));
  }, [summary?.recentBills, profile.currency, profile.locale, t]);

  const filteredSortedBills = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = term
      ? billRows.filter((row) => (
        row.billNo.toLowerCase().includes(term) ||
        row.billType.toLowerCase().includes(term) ||
        row.customer.toLowerCase().includes(term) ||
        row.paymentMode.toLowerCase().includes(term) ||
        String(row.createdBy || "").toLowerCase().includes(term)
      ))
      : billRows;

    const numericKeys = new Set(["grossValue", "discountValue", "netValue"]);
    const dateKeys = new Set(["createdAt"]);
    const sorted = [...filtered].sort((a, b) => {
      if (numericKeys.has(sortKey)) {
        const aVal = Number(a[sortKey] || 0);
        const bVal = Number(b[sortKey] || 0);
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }

      if (dateKeys.has(sortKey)) {
        const aVal = new Date(a.createdAt).getTime();
        const bVal = new Date(b.createdAt).getTime();
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }

      const aVal = String(a[sortKey] || "");
      const bVal = String(b[sortKey] || "");
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });

    return sorted;
  }, [billRows, searchTerm, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredSortedBills.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedBills = filteredSortedBills.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const quickRange = getQuickRange(draftFromDate, draftToDate);
  const rangeLabel = quickRange === "today"
    ? t("dashboard.today")
    : quickRange === "last7"
      ? t("dashboard.last7Days")
      : quickRange === "thisMonth"
          ? t("dashboard.thisMonth")
        : quickRange === "all"
          ? t("dashboard.allTime")
          : (
              appliedFromDate && appliedToDate
                ? t("dashboard.fromTo", { from: appliedFromDate, to: appliedToDate })
                : appliedFromDate
                  ? t("dashboard.fromDate", { date: appliedFromDate })
                  : t("dashboard.upToDate", { date: appliedToDate })
            );

  const totalSalesValue = Number(summary?.totalSales || 0);
  const totalProfitValue = Number(summary?.totalProfit || 0);
  const retailSalesValue = Number(summary?.salesProfitBreakdown?.retailSales || 0);
  const wholesaleSalesValue = Number(summary?.salesProfitBreakdown?.wholesaleSales || 0);
  const retailProfitValue = Number(summary?.salesProfitBreakdown?.retailProfit || 0);
  const wholesaleProfitValue = Number(summary?.salesProfitBreakdown?.wholesaleProfit || 0);
  const totalQtyValue = Number(summary?.totalQtySold || 0);
  const totalInvoicesValue = Number(summary?.totalInvoices || 0);
  const retailInvoices = Number(summary?.invoiceBreakdown?.retail || 0);
  const wholesaleInvoices = Number(summary?.invoiceBreakdown?.wholesale || 0);
  const purchaseInvoices = Number(summary?.invoiceBreakdown?.purchaseOrder || 0);
  const totalInvoicesAllTypes = retailInvoices + wholesaleInvoices + purchaseInvoices || totalInvoicesValue;
  const lowStockCount = Number(summary?.lowStockItems || 0);
  const qtyBreakdown = Array.isArray(summary?.qtyBreakdown) ? summary.qtyBreakdown : [];
  const qtyBreakdownItems = qtyBreakdown.map((entry) => {
    const pack = formatPackLabel(entry.unitSize, entry.unitType);
    return {
      label: pack ? `${entry.productName} (${pack})` : `${entry.productName}`,
      value: formatQuantity(entry.qtySold)
    };
  });
  const invoiceBreakdownItems = [
    { label: t("dashboard.invoiceRetailLabel"), value: String(retailInvoices) },
    { label: t("dashboard.invoiceWholesaleLabel"), value: String(wholesaleInvoices) },
    { label: t("dashboard.invoicePurchaseLabel"), value: String(purchaseInvoices) }
  ];
  const lowStockVariants = Array.isArray(summary?.lowStockVariants) ? summary.lowStockVariants : [];
  const lowStockItems = lowStockVariants.map((entry) => {
    const pack = formatPackLabel(entry.unitSize, entry.unitType);
    return {
      label: pack ? `${entry.productName} (${pack})` : `${entry.productName}`,
      value: formatQuantity(entry.stockQty)
    };
  });
  const salesProfitSections = [
    {
      title: t("dashboard.retailHeading"),
      layout: "pair",
      items: [
        { label: t("dashboard.salesLabel"), value: formatCurrency(retailSalesValue, profile.currency, profile.locale) },
        { label: t("dashboard.profitLabel"), value: formatCurrency(retailProfitValue, profile.currency, profile.locale) }
      ]
    },
    {
      title: t("dashboard.wholesaleHeading"),
      layout: "pair",
      items: [
        { label: t("dashboard.salesLabel"), value: formatCurrency(wholesaleSalesValue, profile.currency, profile.locale) },
        { label: t("dashboard.profitLabel"), value: formatCurrency(wholesaleProfitValue, profile.currency, profile.locale) }
      ]
    }
  ];

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDir("asc");
  }

  function applyQuickRange(type) {
    setError("");
    const today = new Date();
    const todayText = toDateInputValue(today);

    if (type === "today") {
      setDraftFromDate(todayText);
      setDraftToDate(todayText);
      return;
    }

    if (type === "last7") {
      const from = new Date(today);
      from.setDate(today.getDate() - 6);
      setDraftFromDate(toDateInputValue(from));
      setDraftToDate(todayText);
      return;
    }

    if (type === "thisMonth") {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      setDraftFromDate(toDateInputValue(from));
      setDraftToDate(todayText);
      return;
    }

    setDraftFromDate("");
    setDraftToDate("");
  }

  function handleOpenFilter() {
    setError("");
    setDraftFromDate(appliedFromDate);
    setDraftToDate(appliedToDate);
    setIsFilterOpen((prev) => !prev);
  }

  function handleSubmitRange() {
    if (draftFromDate && draftToDate && draftFromDate > draftToDate) {
      setError(t("dashboard.invalidDateRange"));
      return;
    }

    setError("");
    setAppliedFromDate(draftFromDate);
    setAppliedToDate(draftToDate);
    setIsFilterOpen(false);
  }

  return (
    <div>
      <div className="dashboard-header">
        <div>
          <h2>{t("dashboard.title")}</h2>
          <p className="muted">{profile.name} {t("dashboard.summary")}</p>
        </div>
        <div className="dashboard-range-inline" ref={filterRef}>
          <button
            type="button"
            className={`dashboard-range-trigger${isFilterOpen ? " active" : ""}`}
            onClick={handleOpenFilter}
          >
            <span className="small muted">{t("dashboard.dateRange")}</span>
            <strong>{rangeLabel}</strong>
          </button>

          {isFilterOpen && (
            <div className="dashboard-range-popover card compact">
              <div className="dashboard-filter-actions">
                <button type="button" className={quickRange === "today" ? "dashboard-chip-btn active" : "dashboard-chip-btn"} onClick={() => applyQuickRange("today")}>{t("dashboard.today")}</button>
                <button type="button" className={quickRange === "last7" ? "dashboard-chip-btn active" : "dashboard-chip-btn"} onClick={() => applyQuickRange("last7")}>{t("dashboard.last7Days")}</button>
                <button type="button" className={quickRange === "thisMonth" ? "dashboard-chip-btn active" : "dashboard-chip-btn"} onClick={() => applyQuickRange("thisMonth")}>{t("dashboard.thisMonth")}</button>
                <button type="button" className={quickRange === "all" ? "dashboard-chip-btn active" : "dashboard-chip-btn"} onClick={() => applyQuickRange("all")}>{t("dashboard.allTime")}</button>
              </div>
              <div className="dashboard-date-fields">
                <label className="dashboard-date-field">
                  <span className="muted small">{t("dashboard.from")}</span>
                  <input type="date" value={draftFromDate} onChange={(event) => setDraftFromDate(event.target.value)} />
                </label>
                <label className="dashboard-date-field">
                  <span className="muted small">{t("dashboard.to")}</span>
                  <input type="date" value={draftToDate} onChange={(event) => setDraftToDate(event.target.value)} />
                </label>
              </div>
              <div className="dashboard-popover-actions">
                <button type="button" className="ghost" onClick={() => {
                  setDraftFromDate(appliedFromDate);
                  setDraftToDate(appliedToDate);
                  setIsFilterOpen(false);
                }}>{t("common.cancel")}</button>
                <button type="button" onClick={handleSubmitRange}>{t("common.submit")}</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="muted">{t("dashboard.loading")}</p>}

      {!loading && summary && (
        <>
          <div className="dashboard-kpi-grid">
            <StatCard
              title={t("dashboard.totalSales")}
              value={formatCurrency(totalSalesValue, profile.currency, profile.locale)}
              hint={t("dashboard.profitValue", {
                value: formatCurrency(totalProfitValue, profile.currency, profile.locale)
              })}
              hoverTitle={t("dashboard.salesProfitBreakdownTitle")}
              hoverSections={salesProfitSections}
            />
            <StatCard
              title={t("dashboard.qtySoldWithUnit")}
              value={formatMetric(totalQtyValue)}
              hint={t("dashboard.qtySoldHint")}
              hoverTitle={t("dashboard.qtyBreakdownTitle")}
              hoverItems={qtyBreakdownItems.length ? qtyBreakdownItems : [{ label: t("dashboard.noDetails"), value: "" }]}
            />
            <StatCard
              title={t("dashboard.totalInvoices")}
              value={formatMetric(totalInvoicesAllTypes)}
              hint={t("dashboard.selectedRange")}
              hoverTitle={t("dashboard.invoiceBreakdownTitle")}
              hoverItems={invoiceBreakdownItems}
            />
            <StatCard
              title={t("dashboard.lowStockItems")}
              value={formatMetric(lowStockCount)}
              hoverTitle={t("dashboard.lowStockTitle")}
              hoverItems={lowStockItems.length ? lowStockItems : [{ label: t("dashboard.lowStockNone"), value: "" }]}
            />
          </div>

          <div className="card section-gap table-enhanced-wrap dashboard-section-card">
            <div className="section-title-row">
              <div>
                <h3>{t("dashboard.recentBillsTitle")}</h3>
                <p className="muted">{t("dashboard.recentBillsSubtitle")}</p>
              </div>
            </div>
            <div className="table-toolbar">
              <input
                className="table-search"
                placeholder={t("dashboard.searchPlaceholder")}
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setPage(1);
                }}
              />
              <p className="muted small">{t("dashboard.showingRecords", { count: pagedBills.length, total: filteredSortedBills.length })}</p>
            </div>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {billColumns.map((column) => (
                      <th key={column.key} className={column.key === "billType" ? "bill-type-cell" : ""}>
                        <button
                          type="button"
                          className="table-sort-btn"
                          onClick={() => handleSort(
                            column.key === "dateTime" ? "createdAt"
                              : column.key === "gross" ? "grossValue"
                                : column.key === "discount" ? "discountValue"
                                  : column.key === "net" ? "netValue"
                                    : column.key
                          )}
                        >
                          {column.label}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedBills.map((row) => (
                    <tr key={row.id}>
                      <td>{row.billNo}</td>
                      <td className="bill-type-cell">
                        <span className={`bill-type-pill ${row.billTypeKey === "purchase_order" ? "purchase" : row.billTypeKey === "wholesale_order" ? "wholesale" : "retail"}`}>
                          {row.billType}
                        </span>
                      </td>
                      <td>{row.dateTime}</td>
                      <td>{row.customer}</td>
                      <td>{row.paymentMode}</td>
                      <td>{row.gross}</td>
                      <td>{row.discount}</td>
                      <td>{row.net}</td>
                      <td>{row.createdBy}</td>
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
        </>
      )}
    </div>
  );
}

export default DashboardPage;
