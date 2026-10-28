import { query } from "../../db/index.js";
import { resolveEntityTranslations } from "../i18n/i18n.service.js";

function buildDateRangeClause(alias, fromDate, toDate, params) {
  const filters = [];

  if (fromDate) {
    params.push(fromDate);
    filters.push(`${alias}.created_at >= $${params.length}::date`);
  }

  if (toDate) {
    params.push(toDate);
    filters.push(`${alias}.created_at < ($${params.length}::date + INTERVAL '1 day')`);
  }

  return filters.length > 0 ? ` AND ${filters.join(" AND ")}` : "";
}

export async function getSummary(businessId, { fromDate, toDate, locale } = {}) {
  const poTableRes = await query(
    "SELECT to_regclass('public.purchase_order') IS NOT NULL AS exists"
  );
  const hasPurchaseOrders = Boolean(poTableRes.rows[0]?.exists);
  const salesParams = [businessId];
  const purchaseParams = [businessId];
  const mergedParams = [businessId];
  const salesDateClause = buildDateRangeClause("s", fromDate, toDate, salesParams);
  const purchaseDateClause = buildDateRangeClause("po", fromDate, toDate, purchaseParams);
  const mergedSalesDateClause = buildDateRangeClause("s", fromDate, toDate, mergedParams);
  const mergedPurchaseDateClause = buildDateRangeClause("po", fromDate, toDate, mergedParams);

  const recentBillsQuery = hasPurchaseOrders
    ? query(
      `SELECT *
       FROM (
         SELECT s.id,
                s.bill_no,
                s.payment_mode,
                s.gross_total,
                s.discount,
                s.net_total,
                s.created_by,
                s.created_at,
                s.customer_id,
                COALESCE(c.name, 'Walk-in') AS customer_name,
                CASE
                  WHEN s.order_type = 'wholesale' THEN 'wholesale_order'
                  ELSE 'retail_order'
                END AS bill_type
         FROM sale s
         LEFT JOIN customer c ON c.id = s.customer_id
         WHERE s.business_id = $1
         ${mergedSalesDateClause}

         UNION ALL

         SELECT po.id,
                po.purchase_no AS bill_no,
                po.payment_mode,
                po.gross_total,
                po.discount,
                po.net_total,
                po.created_by,
                po.created_at,
                NULL::uuid AS customer_id,
                COALESCE(NULLIF(po.supplier_name, ''), '-') AS customer_name,
                'purchase_order'::text AS bill_type
         FROM purchase_order po
         WHERE po.business_id = $1
         ${mergedPurchaseDateClause}
       ) merged
       ORDER BY created_at DESC
       LIMIT 20`,
      mergedParams
    )
    : query(
      `SELECT s.id,
              s.bill_no,
              s.payment_mode,
              s.gross_total,
              s.discount,
              s.net_total,
              s.created_by,
              s.created_at,
              s.customer_id,
              COALESCE(c.name, 'Walk-in') AS customer_name,
              CASE
                WHEN s.order_type = 'wholesale' THEN 'wholesale_order'
                ELSE 'retail_order'
              END AS bill_type
       FROM sale s
       LEFT JOIN customer c ON c.id = s.customer_id
       WHERE s.business_id = $1
       ${salesDateClause}
       ORDER BY s.created_at DESC
       LIMIT 20`,
      salesParams
    );

  const [todaySalesRes, lowStock, lowStockDetailsRes, recentBills, totalsRes, salesSplitRes, qtyRes, qtyBreakdownRes, dailyAvgRes, profitRes, profitSplitRes, purchaseTotalsRes, invoiceSplitRes] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(net_total), 0)::numeric(12,2) AS today_sales,
              COUNT(*)::int AS bills_count
       FROM sale s
       WHERE s.business_id = $1
       ${salesDateClause}`,
      salesParams
    ),
    query(
      `SELECT COUNT(*)::int AS low_stock
       FROM product_variant
       WHERE business_id = $1 AND stock_qty <= reorder_level AND is_active = true`,
      [businessId]
    ),
    query(
      `SELECT
          pv.product_id,
          p.name AS product_name,
          pv.unit_size,
          pv.unit_type,
          pv.stock_qty
       FROM product_variant pv
       JOIN product p ON p.id = pv.product_id
       WHERE pv.business_id = $1
         AND pv.is_active = true
         AND pv.stock_qty <= pv.reorder_level
       ORDER BY pv.stock_qty ASC, p.name ASC
       LIMIT 5`,
      [businessId]
    ),
    recentBillsQuery,
    query(
      `SELECT COALESCE(SUM(net_total), 0)::numeric(12,2) AS total_sales,
              COUNT(*)::int AS total_invoices
       FROM sale s
       WHERE s.business_id = $1
       ${salesDateClause}`,
      salesParams
    ),
    query(
      `SELECT
          COALESCE(SUM(s.net_total) FILTER (WHERE s.order_type = 'retail'), 0)::numeric(12,2) AS retail_sales,
          COALESCE(SUM(s.net_total) FILTER (WHERE s.order_type = 'wholesale'), 0)::numeric(12,2) AS wholesale_sales
       FROM sale s
       WHERE s.business_id = $1
       ${salesDateClause}`,
      salesParams
    ),
    query(
      `SELECT COALESCE(SUM(si.qty), 0)::int AS total_qty
       FROM sale_item si
       JOIN sale s ON s.id = si.sale_id
       WHERE s.business_id = $1
       ${salesDateClause}`,
      salesParams
    ),
    query(
      `SELECT
          pv.product_id,
          p.name AS product_name,
          pv.unit_size,
          pv.unit_type,
          COALESCE(SUM(si.qty), 0)::numeric(12,3) AS qty_sold
       FROM sale_item si
       JOIN sale s ON s.id = si.sale_id
       JOIN product_variant pv ON pv.id = si.product_variant_id
       JOIN product p ON p.id = pv.product_id
       WHERE s.business_id = $1
       ${salesDateClause}
       GROUP BY pv.product_id, p.name, pv.unit_size, pv.unit_type
       ORDER BY qty_sold DESC, p.name ASC
       LIMIT 5`,
      salesParams
    ),
    query(
      `SELECT COALESCE(AVG(daily_total), 0)::numeric(12,2) AS daily_avg
       FROM (
         SELECT DATE(created_at) AS day, SUM(net_total) AS daily_total
         FROM sale s
         WHERE s.business_id = $1
         ${salesDateClause}
         GROUP BY DATE(created_at)
       ) t`,
      salesParams
    ),
    query(
      `SELECT COALESCE(SUM(si.selling_price_total - si.cost_price_total), 0)::numeric(12,2) AS total_profit
       FROM sale_item si
       JOIN sale s ON s.id = si.sale_id
       WHERE s.business_id = $1
       ${salesDateClause}`,
      salesParams
    ),
    query(
      `SELECT
          COALESCE(SUM(si.selling_price_total - si.cost_price_total) FILTER (WHERE s.order_type = 'retail'), 0)::numeric(12,2) AS retail_profit,
          COALESCE(SUM(si.selling_price_total - si.cost_price_total) FILTER (WHERE s.order_type = 'wholesale'), 0)::numeric(12,2) AS wholesale_profit
       FROM sale_item si
       JOIN sale s ON s.id = si.sale_id
       WHERE s.business_id = $1
       ${salesDateClause}`,
      salesParams
    ),
    hasPurchaseOrders
      ? query(
        `SELECT COALESCE(SUM(net_total), 0)::numeric(12,2) AS total_purchase_spend,
                COUNT(*)::int AS total_purchase_orders
         FROM purchase_order po
         WHERE po.business_id = $1
         ${purchaseDateClause}`,
        purchaseParams
      )
      : Promise.resolve({
        rows: [{ total_purchase_spend: "0.00", total_purchase_orders: 0 }]
      }),
    query(
      `SELECT
          COALESCE(COUNT(*) FILTER (WHERE s.order_type = 'retail'), 0)::int AS retail_invoices,
          COALESCE(COUNT(*) FILTER (WHERE s.order_type = 'wholesale'), 0)::int AS wholesale_invoices
       FROM sale s
       WHERE s.business_id = $1
       ${salesDateClause}`,
      salesParams
    )
      .then((res) => ({
        rows: [{
          retail_invoices: Number(res.rows?.[0]?.retail_invoices || 0),
          wholesale_invoices: Number(res.rows?.[0]?.wholesale_invoices || 0)
        }]
      }))
  ]);

  const todaySales = Number(todaySalesRes.rows[0].today_sales || 0);
  const billsCount = Number(todaySalesRes.rows[0].bills_count || 0);
  const totalSales = Number(totalsRes.rows[0].total_sales || 0);
  const totalProfit = Number(profitRes.rows[0].total_profit || 0);
  const profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;
  const customerIds = recentBills.rows
    .map((row) => row.customer_id)
    .filter(Boolean);
  const productIds = qtyBreakdownRes.rows
    .map((row) => row.product_id)
    .concat(lowStockDetailsRes.rows.map((row) => row.product_id))
    .filter(Boolean);
  const customerTranslations = await resolveEntityTranslations(
    null,
    businessId,
    "customer",
    customerIds,
    ["name"],
    locale
  );
  const productTranslations = await resolveEntityTranslations(
    null,
    businessId,
    "product",
    productIds,
    ["name"],
    locale
  );
  const localizedRecentBills = recentBills.rows.map((row) => {
    const translated = row.customer_id ? customerTranslations.get(row.customer_id) : null;
    return {
      ...row,
      customer_name: translated?.name || row.customer_name
    };
  });
  const qtyBreakdown = qtyBreakdownRes.rows.map((row) => {
    const translated = row.product_id ? productTranslations.get(row.product_id) : null;
    return {
      productId: row.product_id,
      productName: translated?.name || row.product_name,
      unitSize: row.unit_size,
      unitType: row.unit_type,
      qtySold: Number(row.qty_sold || 0)
    };
  });
  const lowStockVariants = lowStockDetailsRes.rows.map((row) => {
    const translated = row.product_id ? productTranslations.get(row.product_id) : null;
    return {
      productId: row.product_id,
      productName: translated?.name || row.product_name,
      unitSize: row.unit_size,
      unitType: row.unit_type,
      stockQty: Number(row.stock_qty || 0)
    };
  });

  return {
    todaySales: todaySalesRes.rows[0].today_sales,
    billsCount: todaySalesRes.rows[0].bills_count,
    lowStockItems: lowStock.rows[0].low_stock,
    avgBillValue: billsCount > 0 ? (todaySales / billsCount).toFixed(2) : "0.00",
    recentBills: localizedRecentBills,
    totalSales: totalsRes.rows[0].total_sales,
    salesProfitBreakdown: {
      retailSales: Number(salesSplitRes.rows[0].retail_sales || 0),
      wholesaleSales: Number(salesSplitRes.rows[0].wholesale_sales || 0),
      retailProfit: Number(profitSplitRes.rows[0].retail_profit || 0),
      wholesaleProfit: Number(profitSplitRes.rows[0].wholesale_profit || 0)
    },
    totalInvoices: totalsRes.rows[0].total_invoices,
    totalQtySold: qtyRes.rows[0].total_qty,
    qtyBreakdown,
    dailyAverageSales: dailyAvgRes.rows[0].daily_avg,
    totalProfit: profitRes.rows[0].total_profit,
    profitMargin,
    totalPurchaseSpend: purchaseTotalsRes.rows[0].total_purchase_spend,
    totalPurchaseOrders: purchaseTotalsRes.rows[0].total_purchase_orders,
    lowStockVariants,
    invoiceBreakdown: {
      retail: invoiceSplitRes.rows[0].retail_invoices,
      wholesale: invoiceSplitRes.rows[0].wholesale_invoices,
      purchaseOrder: Number(purchaseTotalsRes.rows[0].total_purchase_orders || 0)
    }
  };
}
