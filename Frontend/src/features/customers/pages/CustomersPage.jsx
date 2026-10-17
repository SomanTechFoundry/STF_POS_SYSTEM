import { useEffect, useMemo, useState } from "react";
import { createCustomer, deleteCustomer, fetchCustomers, updateCustomer } from "../../../api/customerApi";
import { extractApiError } from "../../../api/client";
import { canAccess } from "../../../app/permissions";
import { useAuthStore } from "../../../store/authStore";
import { useI18n } from "../../../i18n/useI18n";

const initialForm = {
  name: "",
  address: "",
  mobile: "",
  email: ""
};

const PAGE_SIZE = 5;

function CustomersPage() {
  const { user } = useAuthStore();
  const { t, language } = useI18n();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [successText, setSuccessText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState(initialForm);
  const canManage = canAccess(user?.role, "customers");

  async function loadCustomers() {
    const data = await fetchCustomers();
    setRows(
      data.map((item) => ({
        id: item.id,
        name: item.name,
        address: item.address,
        mobile: item.mobile,
        email: item.email,
        createdAt: item.created_at
      }))
    );
  }

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        const data = await fetchCustomers();
        if (!mounted) return;

        setRows(
          data.map((item) => ({
            id: item.id,
            name: item.name,
            address: item.address,
            mobile: item.mobile,
            email: item.email,
            createdAt: item.created_at
          }))
        );
      } catch (err) {
        if (mounted) {
          setError(extractApiError(err, t("customers.failedLoad")));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      mounted = false;
    };
  }, [language]);

  const filteredSortedRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    const filtered = term
      ? rows.filter((row) => (
          row.name.toLowerCase().includes(term) ||
          row.mobile.toLowerCase().includes(term) ||
          row.email.toLowerCase().includes(term) ||
          row.address.toLowerCase().includes(term)
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

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDir("asc");
  }

  async function handleCreateCustomer(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccessText("");

    try {
      await createCustomer({
        name: form.name,
        address: form.address,
        mobile: form.mobile,
        email: form.email
      });

      await loadCustomers();
      setForm(initialForm);
      setSuccessText(t("customers.success"));
    } catch (err) {
      setError(extractApiError(err, t("customers.failedCreate")));
    } finally {
      setSubmitting(false);
    }
  }

  function beginEdit(row) {
    setEditingId(row.id);
    setEditForm({
      name: row.name,
      address: row.address,
      mobile: row.mobile,
      email: row.email
    });
  }

  async function handleUpdateCustomer(event) {
    event.preventDefault();
    if (!editingId) return;

    setSubmitting(true);
    setError("");
    setSuccessText("");

    try {
      await updateCustomer(editingId, {
        name: editForm.name,
        address: editForm.address,
        mobile: editForm.mobile,
        email: editForm.email
      });

      await loadCustomers();
      setEditingId("");
      setEditForm(initialForm);
      setSuccessText(t("customers.updated"));
    } catch (err) {
      setError(extractApiError(err, t("customers.failedUpdate")));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteCustomer(id) {
    if (!window.confirm(t("customers.confirmDelete"))) return;

    setError("");
    setSuccessText("");

    try {
      await deleteCustomer(id);
      await loadCustomers();
      setSuccessText(t("customers.deleted"));
    } catch (err) {
      setError(extractApiError(err, t("customers.failedDelete")));
    }
  }

  return (
    <div>
      <h2>{t("customers.title")}</h2>
      <p className="muted">{t("customers.subtitle")}</p>

      {canManage && (
        <form className="card section-gap" onSubmit={handleCreateCustomer}>
          <h3>{t("customers.addCustomer")}</h3>
          <div className="form-grid">
            <input placeholder={t("customers.enterName")} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
            <input placeholder={t("customers.enterAddress")} value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
            <input placeholder={t("customers.enterMobile")} value={form.mobile} onChange={(e) => setForm((p) => ({ ...p, mobile: e.target.value }))} required />
            <input type="email" placeholder={t("customers.enterEmail")} value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
          </div>
          <div className="actions">
            <button type="submit" disabled={submitting}>{submitting ? t("customers.saving") : t("customers.createCustomer")}</button>
          </div>
        </form>
      )}

      {canManage && editingId && (
        <form className="card section-gap" onSubmit={handleUpdateCustomer}>
          <h3>{t("customers.editCustomer")}</h3>
          <div className="form-grid">
            <input placeholder={t("customers.enterName")} value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} required />
            <input placeholder={t("customers.enterAddress")} value={editForm.address} onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))} />
            <input placeholder={t("customers.enterMobile")} value={editForm.mobile} onChange={(e) => setEditForm((p) => ({ ...p, mobile: e.target.value }))} required />
            <input type="email" placeholder={t("customers.enterEmail")} value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} />
          </div>
          <div className="actions">
            <button type="button" className="ghost" onClick={() => setEditingId("")}>{t("common.cancel")}</button>
            <button type="submit" disabled={submitting}>{submitting ? t("customers.saving") : t("customers.updateCustomer")}</button>
          </div>
        </form>
      )}

      {error && <p className="error-text">{error}</p>}
      {successText && <p className="success-text">{successText}</p>}

      {loading ? (
        <p className="muted">{t("customers.loading")}</p>
      ) : (
        <div className="card section-gap table-enhanced-wrap">
          <div className="table-toolbar">
            <input
              className="table-search"
              placeholder={t("customers.searchPlaceholder")}
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setPage(1);
              }}
            />
            <p className="muted small">{t("customers.showingRecords", { count: pagedRows.length, total: filteredSortedRows.length })}</p>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th><button type="button" className="table-sort-btn" onClick={() => handleSort("name")}>{t("customers.customer")}</button></th>
                  <th><button type="button" className="table-sort-btn" onClick={() => handleSort("mobile")}>{t("customers.mobile")}</button></th>
                  <th><button type="button" className="table-sort-btn" onClick={() => handleSort("email")}>{t("customers.email")}</button></th>
                  <th><button type="button" className="table-sort-btn" onClick={() => handleSort("address")}>{t("customers.address")}</button></th>
                  <th>{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.mobile || "-"}</td>
                    <td>{row.email || "-"}</td>
                    <td>{row.address || "-"}</td>
                    <td>
                      {canManage ? (
                        <div className="row-actions">
                          <button type="button" className="ghost" onClick={() => beginEdit(row)}>{t("common.edit")}</button>
                          <button type="button" className="ghost danger-ghost" onClick={() => handleDeleteCustomer(row.id)}>{t("common.delete")}</button>
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
      )}
    </div>
  );
}

export default CustomersPage;
