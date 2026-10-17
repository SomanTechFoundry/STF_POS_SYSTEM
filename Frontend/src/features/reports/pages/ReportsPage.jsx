import { useEffect, useMemo, useState } from "react";
import { extractApiError } from "../../../api/client";
import { fetchSales } from "../../../api/salesApi";
import StatCard from "../../../components/ui/StatCard";
import { useI18n } from "../../../i18n/useI18n";
import { formatCurrency, getBusinessProfile } from "../../../utils/formatters";

function ReportsPage() {
  const profile = getBusinessProfile();
  const { t, language } = useI18n();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadSales() {
      try {
        const data = await fetchSales();
        if (!mounted) return;
        setSales(data);
      } catch (err) {
        if (mounted) {
          setError(extractApiError(err, t("reports.failedLoad")));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadSales();

    return () => {
      mounted = false;
    };
  }, [language]);

  const summary = useMemo(() => {
    const grossSales = sales.reduce((sum, item) => sum + Number(item.net_total || 0), 0);
    const billCount = sales.length;
    const avgBill = billCount > 0 ? grossSales / billCount : 0;

    return {
      grossSales,
      billCount,
      avgBill
    };
  }, [sales]);

  return (
    <div>
      <h2>{t("reports.title")}</h2>
      <p className="muted">{t("reports.subtitle")}</p>
      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p className="muted">{t("reports.loading")}</p>
      ) : (
        <div className="grid-3">
          <StatCard
            title={t("reports.grossSales")}
            value={formatCurrency(summary.grossSales, profile.currency, profile.locale)}
            hint={t("reports.allSales")}
          />
          <StatCard title={t("reports.billsCount")} value={String(summary.billCount)} hint={t("reports.latest100")} />
          <StatCard
            title={t("reports.avgBill")}
            value={formatCurrency(summary.avgBill, profile.currency, profile.locale)}
            hint={t("reports.computed")}
          />
        </div>
      )}
    </div>
  );
}

export default ReportsPage;
