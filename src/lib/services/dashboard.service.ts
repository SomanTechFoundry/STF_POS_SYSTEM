import { prisma } from "@/lib/db/prisma";
import { resolveEntityTranslations } from "@/lib/services/i18n.service";

type SummaryOptions = {
  fromDate?: string;
  toDate?: string;
  locale?: string;
};

function dateClause(alias: string, fromDate?: string, toDate?: string, startIndex = 2) {
  const parts: string[] = [];
  const params: string[] = [];
  let idx = startIndex;

  if (fromDate) {
    parts.push(`${alias}.created_at >= $${idx}::date`);
    params.push(fromDate);
    idx += 1;
  }
  if (toDate) {
    parts.push(`${alias}.created_at < ($${idx}::date + INTERVAL '1 day')`);
    params.push(toDate);
    idx += 1;
  }

  return {
    sql: parts.length ? ` AND ${parts.join(" AND ")}` : "",
    params,
  };
}

export async function getSummary(businessId: string, options: SummaryOptions = {}) {
  const { fromDate, toDate, locale = "en-IN" } = options;

  const salesDate = dateClause("s", fromDate, toDate);
  const purchaseDate = dateClause("po", fromDate, toDate);
  const salesParams = [businessId, ...salesDate.params];
  const purchaseParams = [businessId, ...purchaseDate.params];

  const mergedSalesDate = dateClause("s", fromDate, toDate);
  const mergedPurchaseParams: string[] = [];
  if (fromDate) mergedPurchaseParams.push(fromDate);
  if (toDate) mergedPurchaseParams.push(toDate);
  const mergedParams = [businessId, ...mergedSalesDate.params, ...mergedPurchaseParams];
  const mergedPurchaseSql = (() => {
    const parts: string[] = [];
    let idx = 2 + mergedSalesDate.params.length;
    if (fromDate) {
      parts.push(`po.created_at >= $${idx}::date`);
      idx += 1;
    }
    if (toDate) {
      parts.push(`po.created_at < ($${idx}::date + INTERVAL '1 day')`);
    }
    return parts.length ? ` AND ${parts.join(" AND ")}` : "";
  })();

  const [
    todaySalesRes,
    lowStock,
    lowStockDetailsRes,
    recentBills,
    totalsRes,
    salesSplitRes,
    qtyRes,
    qtyBreakdownRes,
    dailyAvgRes,
    profitRes,
    profitSplitRes,
    purchaseTotalsRes,
    invoiceSplitRes,
  ] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ today_sales: unknown; bills_count: number }>>(
      `SELECT COALESCE(SUM(net_total), 0)::numeric(12,2) AS today_sales,
              COUNT(*)::int AS bills_count
       FROM sale s
       WHERE s.business_id = $1::uuid
       ${salesDate.sql}`,
      ...salesParams,
    ),
    prisma.$queryRawUnsafe<Array<{ low_stock: number }>>(
      `SELECT COUNT(*)::int AS low_stock
       FROM product_variant
       WHERE business_id = $1::uuid AND stock_qty <= reorder_level AND is_active = true`,
      businessId,
    ),
    prisma.$queryRawUnsafe<
      Array<{
        product_id: string;
        product_name: string;
        unit_size: unknown;
        unit_type: string;
        stock_qty: number;
      }>
    >(
      `SELECT
          pv.product_id,
          p.name AS product_name,
          pv.unit_size,
          pv.unit_type,
          pv.stock_qty
       FROM product_variant pv
       JOIN product p ON p.id = pv.product_id
       WHERE pv.business_id = $1::uuid
         AND pv.is_active = true
         AND pv.stock_qty <= pv.reorder_level
       ORDER BY pv.stock_qty ASC, p.name ASC
       LIMIT 5`,
      businessId,
    ),
    prisma.$queryRawUnsafe<
      Array<{
        id: string;
        bill_no: unknown;
        payment_mode: string;
        gross_total: unknown;
        discount: unknown;
        net_total: unknown;
        created_by: string;
        created_at: Date;
        customer_id: string | null;
        customer_name: string;
        bill_type: string;
      }>
    >(
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
         WHERE s.business_id = $1::uuid
         ${mergedSalesDate.sql}

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
         WHERE po.business_id = $1::uuid
         ${mergedPurchaseSql}
       ) merged
       ORDER BY created_at DESC
       LIMIT 20`,
      ...mergedParams,
    ),
    prisma.$queryRawUnsafe<Array<{ total_sales: unknown; total_invoices: number }>>(
      `SELECT COALESCE(SUM(net_total), 0)::numeric(12,2) AS total_sales,
              COUNT(*)::int AS total_invoices
       FROM sale s
       WHERE s.business_id = $1::uuid
       ${salesDate.sql}`,
      ...salesParams,
    ),
    prisma.$queryRawUnsafe<Array<{ retail_sales: unknown; wholesale_sales: unknown }>>(
      `SELECT
          COALESCE(SUM(s.net_total) FILTER (WHERE s.order_type = 'retail'), 0)::numeric(12,2) AS retail_sales,
          COALESCE(SUM(s.net_total) FILTER (WHERE s.order_type = 'wholesale'), 0)::numeric(12,2) AS wholesale_sales
       FROM sale s
       WHERE s.business_id = $1::uuid
       ${salesDate.sql}`,
      ...salesParams,
    ),
    prisma.$queryRawUnsafe<Array<{ total_qty: number }>>(
      `SELECT COALESCE(SUM(si.qty), 0)::int AS total_qty
       FROM sale_item si
       JOIN sale s ON s.id = si.sale_id
       WHERE s.business_id = $1::uuid
       ${salesDate.sql}`,
      ...salesParams,
    ),
    prisma.$queryRawUnsafe<
      Array<{
        product_id: string;
        product_name: string;
        unit_size: unknown;
        unit_type: string;
        qty_sold: unknown;
      }>
    >(
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
       WHERE s.business_id = $1::uuid
       ${salesDate.sql}
       GROUP BY pv.product_id, p.name, pv.unit_size, pv.unit_type
       ORDER BY qty_sold DESC, p.name ASC
       LIMIT 5`,
      ...salesParams,
    ),
    prisma.$queryRawUnsafe<Array<{ daily_avg: unknown }>>(
      `SELECT COALESCE(AVG(daily_total), 0)::numeric(12,2) AS daily_avg
       FROM (
         SELECT DATE(created_at) AS day, SUM(net_total) AS daily_total
         FROM sale s
         WHERE s.business_id = $1::uuid
         ${salesDate.sql}
         GROUP BY DATE(created_at)
       ) t`,
      ...salesParams,
    ),
    prisma.$queryRawUnsafe<Array<{ total_profit: unknown }>>(
      `SELECT COALESCE(SUM(si.selling_price_total - si.cost_price_total), 0)::numeric(12,2) AS total_profit
       FROM sale_item si
       JOIN sale s ON s.id = si.sale_id
       WHERE s.business_id = $1::uuid
       ${salesDate.sql}`,
      ...salesParams,
    ),
    prisma.$queryRawUnsafe<Array<{ retail_profit: unknown; wholesale_profit: unknown }>>(
      `SELECT
          COALESCE(SUM(si.selling_price_total - si.cost_price_total) FILTER (WHERE s.order_type = 'retail'), 0)::numeric(12,2) AS retail_profit,
          COALESCE(SUM(si.selling_price_total - si.cost_price_total) FILTER (WHERE s.order_type = 'wholesale'), 0)::numeric(12,2) AS wholesale_profit
       FROM sale_item si
       JOIN sale s ON s.id = si.sale_id
       WHERE s.business_id = $1::uuid
       ${salesDate.sql}`,
      ...salesParams,
    ),
    prisma.$queryRawUnsafe<
      Array<{ total_purchase_spend: unknown; total_purchase_orders: number }>
    >(
      `SELECT COALESCE(SUM(net_total), 0)::numeric(12,2) AS total_purchase_spend,
              COUNT(*)::int AS total_purchase_orders
       FROM purchase_order po
       WHERE po.business_id = $1::uuid
       ${purchaseDate.sql}`,
      ...purchaseParams,
    ),
    prisma.$queryRawUnsafe<Array<{ retail_invoices: number; wholesale_invoices: number }>>(
      `SELECT
          COALESCE(COUNT(*) FILTER (WHERE s.order_type = 'retail'), 0)::int AS retail_invoices,
          COALESCE(COUNT(*) FILTER (WHERE s.order_type = 'wholesale'), 0)::int AS wholesale_invoices
       FROM sale s
       WHERE s.business_id = $1::uuid
       ${salesDate.sql}`,
      ...salesParams,
    ),
  ]);

  const todaySales = Number(todaySalesRes[0]?.today_sales || 0);
  const billsCount = Number(todaySalesRes[0]?.bills_count || 0);
  const totalSales = Number(totalsRes[0]?.total_sales || 0);
  const totalProfit = Number(profitRes[0]?.total_profit || 0);
  const profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

  const customerIds = recentBills.map((row) => row.customer_id).filter(Boolean) as string[];
  const productIds = [
    ...qtyBreakdownRes.map((row) => row.product_id),
    ...lowStockDetailsRes.map((row) => row.product_id),
  ].filter(Boolean);

  const [customerTranslations, productTranslations] = await Promise.all([
    resolveEntityTranslations(null, businessId, "customer", customerIds, ["name"], locale),
    resolveEntityTranslations(null, businessId, "product", productIds, ["name"], locale),
  ]);

  const localizedRecentBills = recentBills.map((row) => {
    const translated = row.customer_id ? customerTranslations.get(row.customer_id) : null;
    return {
      ...row,
      bill_no: Number(row.bill_no),
      gross_total: Number(row.gross_total),
      discount: Number(row.discount),
      net_total: Number(row.net_total),
      customer_name: translated?.name || row.customer_name,
    };
  });

  const qtyBreakdown = qtyBreakdownRes.map((row) => {
    const translated = productTranslations.get(row.product_id);
    return {
      productId: row.product_id,
      productName: translated?.name || row.product_name,
      unitSize: Number(row.unit_size || 0),
      unitType: row.unit_type,
      qtySold: Number(row.qty_sold || 0),
    };
  });

  const lowStockVariants = lowStockDetailsRes.map((row) => {
    const translated = productTranslations.get(row.product_id);
    return {
      productId: row.product_id,
      productName: translated?.name || row.product_name,
      unitSize: Number(row.unit_size || 0),
      unitType: row.unit_type,
      stockQty: Number(row.stock_qty || 0),
    };
  });

  return {
    todaySales: todaySalesRes[0]?.today_sales ?? "0.00",
    billsCount: todaySalesRes[0]?.bills_count ?? 0,
    lowStockItems: lowStock[0]?.low_stock ?? 0,
    avgBillValue: billsCount > 0 ? (todaySales / billsCount).toFixed(2) : "0.00",
    recentBills: localizedRecentBills,
    totalSales: totalsRes[0]?.total_sales ?? "0.00",
    salesProfitBreakdown: {
      retailSales: Number(salesSplitRes[0]?.retail_sales || 0),
      wholesaleSales: Number(salesSplitRes[0]?.wholesale_sales || 0),
      retailProfit: Number(profitSplitRes[0]?.retail_profit || 0),
      wholesaleProfit: Number(profitSplitRes[0]?.wholesale_profit || 0),
    },
    totalInvoices: totalsRes[0]?.total_invoices ?? 0,
    totalQtySold: qtyRes[0]?.total_qty ?? 0,
    qtyBreakdown,
    dailyAverageSales: dailyAvgRes[0]?.daily_avg ?? "0.00",
    totalProfit: profitRes[0]?.total_profit ?? "0.00",
    profitMargin,
    totalPurchaseSpend: purchaseTotalsRes[0]?.total_purchase_spend ?? "0.00",
    totalPurchaseOrders: purchaseTotalsRes[0]?.total_purchase_orders ?? 0,
    lowStockVariants,
    invoiceBreakdown: {
      retail: invoiceSplitRes[0]?.retail_invoices ?? 0,
      wholesale: invoiceSplitRes[0]?.wholesale_invoices ?? 0,
      purchaseOrder: Number(purchaseTotalsRes[0]?.total_purchase_orders || 0),
    },
  };
}
