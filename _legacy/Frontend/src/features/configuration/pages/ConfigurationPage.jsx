import { useEffect, useMemo, useState } from "react";
import { extractApiError } from "../../../api/client";
import {
  fetchEntityTranslations,
  fetchUsers,
  updateEntityTranslation,
  updateUserAccess
} from "../../../api/userApi";
import { useI18n } from "../../../i18n/useI18n";
import { useAuthStore } from "../../../store/authStore";

const roles = ["admin", "owner", "viewer"];
const PAGE_SIZE = 5;

function rowKey(row) {
  return `${row.entity_id}:${row.field_name}`;
}

function ConfigurationPage() {
  const { user: currentUser } = useAuthStore();
  const { t, language } = useI18n();

  const [users, setUsers] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");

  const [entityType, setEntityType] = useState("product");
  const [locale, setLocale] = useState("ta-IN");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [translationLoading, setTranslationLoading] = useState(true);
  const [translationSavingKey, setTranslationSavingKey] = useState("");
  const [translationRows, setTranslationRows] = useState([]);
  const [translationDrafts, setTranslationDrafts] = useState({});
  const [translationTotal, setTranslationTotal] = useState(0);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadUsers() {
      try {
        const userData = await fetchUsers();
        if (!mounted) return;

        setUsers(userData);
        setDrafts(
          userData.reduce((acc, item) => {
            acc[item.id] = { role: item.role, isActive: item.is_active };
            return acc;
          }, {})
        );
      } catch (err) {
        if (mounted) setError(extractApiError(err, t("configuration.failedLoad")));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadUsers();

    return () => {
      mounted = false;
    };
  }, [language, t]);

  useEffect(() => {
    let mounted = true;

    async function loadTranslations() {
      setTranslationLoading(true);
      try {
        const data = await fetchEntityTranslations({
          entityType,
          locale,
          search,
          page,
          pageSize: PAGE_SIZE
        });

        if (!mounted) return;
        setTranslationRows(data.rows || []);
        setTranslationTotal(Number(data.total || 0));
        setTranslationDrafts(
          (data.rows || []).reduce((acc, item) => {
            acc[rowKey(item)] = item.translated_value || "";
            return acc;
          }, {})
        );
      } catch (err) {
        if (mounted) setError(extractApiError(err, t("configuration.failedLoadTranslations")));
      } finally {
        if (mounted) setTranslationLoading(false);
      }
    }

    loadTranslations();
    return () => {
      mounted = false;
    };
  }, [entityType, locale, search, page, language, t]);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      if (a.email === currentUser?.email) return -1;
      if (b.email === currentUser?.email) return 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [users, currentUser?.email]);

  const totalPages = Math.max(1, Math.ceil(translationTotal / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  async function handleSave(userId) {
    setSavingId(userId);
    setError("");
    setSuccess("");

    try {
      const updated = await updateUserAccess(userId, drafts[userId]);
      setUsers((prev) => prev.map((item) => (item.id === userId ? updated : item)));
      setSuccess(t("configuration.updated"));
    } catch (err) {
      setError(extractApiError(err, t("configuration.failedUpdate")));
    } finally {
      setSavingId("");
    }
  }

  async function handleSaveTranslation(row) {
    const key = rowKey(row);
    setTranslationSavingKey(key);
    setError("");
    setSuccess("");

    try {
      const saved = await updateEntityTranslation({
        entityType,
        entityId: row.entity_id,
        fieldName: row.field_name,
        locale,
        value: translationDrafts[key] || ""
      });

      setTranslationRows((prev) => prev.map((item) => (
        rowKey(item) === key
          ? { ...item, translated_value: saved.value || "" }
          : item
      )));
      setTranslationDrafts((prev) => ({ ...prev, [key]: saved.value || "" }));
      setSuccess(t("configuration.translationSaved"));
    } catch (err) {
      setError(extractApiError(err, t("configuration.failedUpdateTranslation")));
    } finally {
      setTranslationSavingKey("");
    }
  }

  function patchDraft(userId, patch) {
    setDrafts((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        ...patch
      }
    }));
  }

  return (
    <div>
      <h2>{t("configuration.title")}</h2>
      <p className="muted">{t("configuration.subtitle")}</p>
      {error && <p className="error-text">{error}</p>}
      {success && <p className="success-text">{success}</p>}

      {loading ? (
        <p className="muted">{t("configuration.loading")}</p>
      ) : (
        <div className="card section-gap table-enhanced-wrap">
          <div className="table-toolbar">
            <h3>{t("configuration.userAccess")}</h3>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("configuration.name")}</th>
                  <th>{t("configuration.email")}</th>
                  <th>{t("configuration.role")}</th>
                  <th>{t("configuration.visibleActive")}</th>
                  <th>{t("common.action")}</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((item) => {
                  const draft = drafts[item.id] || { role: item.role, isActive: item.is_active };
                  const isSelf = item.email === currentUser?.email;

                  return (
                    <tr key={item.id}>
                      <td>{item.full_name}</td>
                      <td>{item.email}</td>
                      <td>
                        <select
                          value={draft.role}
                          onChange={(event) => patchDraft(item.id, { role: event.target.value })}
                          disabled={savingId === item.id}
                        >
                          {roles.map((role) => (
                            <option key={role} value={role}>{t(`configuration.role_${role}`)}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <label className="toggle-inline">
                          <input
                            type="checkbox"
                            checked={Boolean(draft.isActive)}
                            onChange={(event) => patchDraft(item.id, { isActive: event.target.checked })}
                            disabled={savingId === item.id || isSelf}
                          />
                          <span>{draft.isActive ? t("configuration.active") : t("configuration.disabled")}</span>
                        </label>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleSave(item.id)}
                          disabled={savingId === item.id}
                        >
                          {savingId === item.id ? t("common.saving") : t("common.save")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card section-gap table-enhanced-wrap">
        <div className="translation-header">
          <div>
            <h3>{t("configuration.translationEditor")}</h3>
            <p className="muted small">{t("configuration.translationHint")}</p>
          </div>
          <span className="translation-count-badge">{translationTotal}</span>
        </div>

        <div className="translation-filters">
          <div className="translation-entity-toggle">
            <button
              type="button"
              className={entityType === "product" ? "translation-toggle-btn active" : "translation-toggle-btn"}
              onClick={() => {
                setEntityType("product");
                setPage(1);
              }}
            >
              {t("configuration.entityProduct")}
            </button>
            <button
              type="button"
              className={entityType === "customer" ? "translation-toggle-btn active" : "translation-toggle-btn"}
              onClick={() => {
                setEntityType("customer");
                setPage(1);
              }}
            >
              {t("configuration.entityCustomer")}
            </button>
          </div>

          <div className="translation-filter-right">
            <select value={locale} onChange={(event) => {
              setLocale(event.target.value);
              setPage(1);
            }}>
              <option value="ta-IN">Tamil (ta-IN)</option>
              <option value="en-IN">English (en-IN)</option>
            </select>

            <input
              className="table-search"
              placeholder={t("configuration.translationSearch")}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        {translationLoading ? (
          <p className="muted">{t("configuration.loadingTranslations")}</p>
        ) : (
          <>
            <div className="table-scroll translation-table-wrap">
              <table className="translation-table">
                <thead>
                  <tr>
                    <th>{t("configuration.entity")}</th>
                    <th>{t("configuration.field")}</th>
                    <th>{t("configuration.sourceText")}</th>
                    <th>{t("configuration.translatedText")}</th>
                    <th>{t("common.action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {translationRows.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="muted">{t("configuration.noTranslations")}</td>
                    </tr>
                  ) : (
                    translationRows.map((row) => {
                      const key = rowKey(row);
                      const currentValue = row.translated_value || "";
                      const draftValue = translationDrafts[key] || "";
                      const isDirty = draftValue !== currentValue;

                      return (
                        <tr key={key}>
                          <td className="translation-entity-cell">{row.display_name}</td>
                          <td><span className="translation-field-pill">{t(`configuration.field_${row.field_name}`)}</span></td>
                          <td>
                            <div className="translation-source-text">{row.source_value || "-"}</div>
                          </td>
                          <td>
                            <input
                              className="translation-input"
                              value={draftValue}
                              placeholder={t("configuration.translatedText")}
                              onChange={(event) => setTranslationDrafts((prev) => ({
                                ...prev,
                                [key]: event.target.value
                              }))}
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className={isDirty ? "" : "ghost"}
                              onClick={() => handleSaveTranslation(row)}
                              disabled={translationSavingKey === key || !isDirty}
                            >
                              {translationSavingKey === key ? t("common.saving") : t("common.save")}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="pagination-row">
              <button
                type="button"
                className="ghost"
                disabled={currentPage <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                {t("common.previous")}
              </button>
              <p className="small muted">{t("common.pageOf", { page: currentPage, total: totalPages })}</p>
              <button
                type="button"
                className="ghost"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                {t("common.next")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ConfigurationPage;
