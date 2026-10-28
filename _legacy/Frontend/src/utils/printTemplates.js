import { formatCurrency } from "./formatters";
import { translations } from "../i18n/translations";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function splitMoneyParts(amount) {
  const safe = Number(amount || 0).toFixed(2);
  const [rs, ps] = safe.split(".");
  return { rs, ps };
}

function openAndPrint(html, features = "width=900,height=700") {
  const printWindow = window.open("", "_blank", features);
  if (!printWindow) return false;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  return true;
}

function getPrintLabels(locale = "en-IN") {
  const lang = String(locale || "").toLowerCase().startsWith("ta") ? "ta" : "en";
  const dict = translations[lang] || translations.en;
  const fallback = translations.en;
  const resolve = (path) => path.split(".").reduce((acc, part) => acc?.[part], dict)
    ?? path.split(".").reduce((acc, part) => acc?.[part], fallback)
    ?? path;

  return {
    invoice: resolve("print.invoice"),
    billNo: resolve("print.billNo"),
    date: resolve("print.date"),
    customer: resolve("print.customer"),
    buyerSignature: resolve("print.buyerSignature"),
    forLabel: resolve("print.forLabel"),
    mrs: resolve("print.mrs"),
    terms: resolve("print.terms"),
    weight: resolve("print.weight"),
    particulars: resolve("print.particulars"),
    bags: resolve("print.bags"),
    rateRs: resolve("print.rateRs"),
    amountRs: resolve("print.amountRs"),
    rupees: resolve("print.rupees"),
    item: resolve("print.item"),
    spec: resolve("print.spec"),
    qty: resolve("print.qty"),
    amount: resolve("print.amount"),
    total: resolve("print.total"),
    sgst: resolve("print.sgst"),
    cgst: resolve("print.cgst"),
    grandTotal: resolve("print.grandTotal"),
    disclaimer: resolve("print.disclaimer"),
    retail: resolve("billType.retail_order"),
    wholesale: resolve("billType.wholesale_order"),
    walkIn: resolve("common.walkIn"),
    plNo: resolve("bill.plNo"),
    slNo: resolve("bill.slNo"),
    gstin: resolve("bill.gstin"),
    flPlSlNo: resolve("bill.flPlSlNo")
  };
}

function printWholesaleFormat(bill, profile, billProfile = {}) {
  const locale = profile?.locale || "en-IN";
  const labels = getPrintLabels(locale);
  const bp = { ...billProfile };
  const businessName = bp.businessName || bill.businessName || "";
  const businessDescription = bp.businessDescription || "";
  const address = bp.address || "";
  const city = bp.city || "";
  const fitSize = (text, large, medium, small, xsmall) => {
    const len = String(text || "").trim().length;
    if (len > 80) return xsmall;
    if (len > 55) return small;
    if (len > 35) return medium;
    return large;
  };
  const shopFontSize = fitSize(businessName, 16, 14, 12, 11);
  const descFontSize = fitSize(businessDescription, 9, 8, 7, 6.5);
  const addrFontSize = fitSize(address, 8, 7.5, 7, 6.5);
  const cityFontSize = fitSize(city, 13, 11, 10, 9);
  const termsText = bp.termsAndConditions || "";
  const termsLines = String(termsText)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const tinDisplay = bill.wholesaleTinNo || "-";
  const flPlSlDisplay = bill.wholesaleFlPlSlNo || "-";
  const paperSize = String(bp.wholesalePaperSize || "A4").toUpperCase() === "A5" ? "A5" : "A4";
  const sheetWidth = paperSize === "A5" ? "560px" : "820px";
  const windowSize = paperSize === "A5" ? "width=760,height=940" : "width=930,height=760";
  const linesHtml = bill.items.map((item) => {
    const lineTotal = Number(item.qty) * Number(item.salePrice);
    const rate = splitMoneyParts(item.salePrice);
    const amount = splitMoneyParts(lineTotal);
    return `
      <tr>
        <td></td>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(String(item.qty))}</td>
        <td>${escapeHtml(rate.rs)}</td>
        <td>${escapeHtml(rate.ps)}</td>
        <td>${escapeHtml(amount.rs)}</td>
        <td>${escapeHtml(amount.ps)}</td>
      </tr>
    `;
  }).join("");

  const totalParts = splitMoneyParts(bill.netTotal);
  const billDate = bill.createdAtText || new Date().toLocaleString(locale);

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <title>Wholesale Bill #${escapeHtml(bill.billNo)}</title>
        <style>
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body{font-family:"Times New Roman",serif;color:#1b6a59;margin:0;padding:8px}
          @page { size: ${paperSize} portrait; margin: 8mm; }
          .sheet{
            max-width:${sheetWidth};
            margin:0 auto;
            border:2.6px solid #174d43;
            box-sizing:border-box;
            background:#fff;
            padding:4px;
            display:block;
          }
          .top{display:grid;grid-template-columns:150px 1fr;border-bottom:1.3px solid #2c6f63}
          .left-box{border-right:1.3px solid #2c6f63;padding:6px 8px;font-size:11px;line-height:1.3}
          .left-box .title{
            font-size:22px;
            font-weight:700;
            letter-spacing:.6px;
            margin-bottom:4px;
            background:#226f5f;
            color:#ffffff;
            padding:2px 6px;
            display:inline-block;
            line-height:1.1;
          }
          .head-main{
            padding:6px 8px 4px;
            min-height:114px;
            display:flex;
            flex-direction:column;
          }
          .head-main-top{
            display:flex;
            justify-content:center;
            text-align:center;
            flex:1;
          }
          .head-center{width:100%;align-self:center}
          .shop{letter-spacing:.3px;font-weight:700;line-height:1.1;margin-top:1px}
          .dealer{font-weight:700;margin-top:2px;line-height:1.15}
          .addr{margin-top:2px;line-height:1.2}
          .city{font-weight:700;line-height:1.1;margin-top:2px}
          .invoice-meta{
            display:grid;
            grid-template-columns:1fr 1fr;
            align-items:end;
            margin-top:auto;
            padding-top:4px;
            font-size:10px;
            gap:14px;
          }
          .meta-line{display:grid;grid-template-columns:auto 1fr;align-items:end;column-gap:6px}
          .meta-label-left{font-size:9px;line-height:1}
          .meta-right{display:grid;align-items:end;row-gap:0}
          .meta-value{
            font-weight:600;
            line-height:1;
            min-height:0;
            text-align:center;
            margin:0;
            padding:0 0 0.5px;
          }
          .meta-dots{width:100%;border-bottom:1px dotted #2e7b6e;height:3px}
          .line{border-bottom:1px dotted #2e7b6e;min-height:16px;display:grid;grid-template-columns:auto 1fr;align-items:flex-end;gap:5px;padding-bottom:1px}
          .line-value{text-align:center;font-weight:600}
          .mid{padding:6px 8px;font-size:10px;border-top:1.2px solid #2c6f63;border-bottom:1.2px solid #2c6f63}
          table{width:100%;border-collapse:collapse;font-size:10px;color:#1b6a59}
          th,td{border:1.2px solid #2c6f63;padding:3px 4px;text-align:center}
          th{font-size:9px;background:#f5fbf9;font-weight:700}
          td:nth-child(2),th:nth-child(2){text-align:left}
          .empty-row td{height:190px}
          .tot{font-weight:700}
          .footer{padding:6px 8px;border-top:1.2px solid #2c6f63}
          .bill-section-border{border:1.2px solid #2c6f63;border-top:0}
          .terms-title{text-align:center;font-size:10px;font-weight:700;margin:3px 0}
          .terms-wrap{display:grid;justify-items:center;text-align:center}
          .terms{font-size:8px;line-height:1.3;text-align:center}
          .rupees-line{display:grid;grid-template-columns:auto 1fr;align-items:end;gap:6px;font-size:10px}
          .rupees-right{display:grid;align-items:end;row-gap:0}
          .rupees-dots{width:100%;border-bottom:1px dotted #2e7b6e;height:3px}
          .rupees-value{
            font-weight:600;
            text-align:center;
            line-height:1;
            min-height:0;
            margin:0;
            padding:0 0 0.5px;
          }
          .sign{display:flex;justify-content:space-between;margin-top:5px;font-size:9px}
          .copyright{margin-top:6px;text-align:center;font-size:10px;color:#4a7d74}
          @media print{
            body{padding:0}
            .sheet{
              border:2.6px solid #174d43 !important;
              -webkit-print-color-adjust:exact;
              print-color-adjust:exact;
            }
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="top">
            <div class="left-box">
              <div class="title">${escapeHtml(labels.invoice)}</div>
              <div>TIN. No.&nbsp;&nbsp;${escapeHtml(bp.tinNo || "-")}</div>
              <div>CST. No.&nbsp;${escapeHtml(bp.cstNo || "-")}</div>
              <div>W.E.L. No.&nbsp;${escapeHtml(bp.welNo || "-")}</div>
              <div>PL. No.&nbsp;&nbsp;&nbsp;&nbsp;${escapeHtml(bp.plNo || "-")}</div>
              <div>SL. No.&nbsp;&nbsp;&nbsp;&nbsp;${escapeHtml(bp.slNo || "-")}</div>
            </div>
            <div class="head-main">
              <div class="head-main-top">
                <div class="head-center">
                  <div class="shop" style="font-size:${shopFontSize}px">${escapeHtml(businessName.toUpperCase())}</div>
                  <div class="dealer" style="font-size:${descFontSize}px">${escapeHtml(businessDescription)}</div>
                  <div class="addr" style="font-size:${addrFontSize}px">${escapeHtml(address)}</div>
                  <div class="city" style="font-size:${cityFontSize}px">${escapeHtml(city)}</div>
                </div>
              </div>
              <div class="invoice-meta">
                <div class="meta-line">
                  <div class="meta-label-left">${escapeHtml(labels.billNo)}</div>
                  <div class="meta-right">
                    <div class="meta-value">${escapeHtml(String(bill.billNo))}</div>
                    <div class="meta-dots"></div>
                  </div>
                </div>
                <div class="meta-line">
                  <div class="meta-label-left">${escapeHtml(labels.date)}</div>
                  <div class="meta-right">
                    <div class="meta-value">${escapeHtml(billDate.split(",")[0] || billDate)}</div>
                    <div class="meta-dots"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="mid">
            <div class="line"><span>${escapeHtml(labels.mrs)}</span><span class="line-value">${escapeHtml(bill.customerName || "-")}</span></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px">
              <div class="line"><span>TIN. No</span><span class="line-value">${escapeHtml(tinDisplay)}</span></div>
              <div class="line"><span>${escapeHtml(labels.flPlSlNo)}</span><span class="line-value">${escapeHtml(flPlSlDisplay)}</span></div>
            </div>
          </div>

          <div class="bill-section-border">
            <table>
              <thead>
                <tr>
                  <th style="width:90px">${escapeHtml(labels.weight)}</th>
                  <th>${escapeHtml(labels.particulars)}</th>
                  <th style="width:70px">${escapeHtml(labels.bags)}</th>
                  <th style="width:70px">${escapeHtml(labels.rateRs)}</th>
                  <th style="width:45px">Ps.</th>
                  <th style="width:80px">${escapeHtml(labels.amountRs)}</th>
                  <th style="width:45px">Ps.</th>
                </tr>
              </thead>
              <tbody>
                ${linesHtml || '<tr class="empty-row"><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>'}
                <tr class="tot"><td colspan="2">${escapeHtml(labels.total.toUpperCase())}</td><td></td><td></td><td></td><td>${escapeHtml(totalParts.rs)}</td><td>${escapeHtml(totalParts.ps)}</td></tr>
              </tbody>
            </table>
          </div>

          <div class="footer">
            <div class="rupees-line">
              <span>${escapeHtml(labels.rupees)}</span>
              <span class="rupees-right">
                <span class="rupees-value">${escapeHtml(formatCurrency(bill.netTotal, profile?.currency || "INR", locale))}</span>
                <span class="rupees-dots"></span>
              </span>
            </div>
            <div class="terms-wrap">
              <div class="terms-title">${escapeHtml(labels.terms)} :</div>
              ${termsLines.length > 0
                ? termsLines.map((line, index) => `<div class="terms">${index + 1}) ${escapeHtml(line)}</div>`).join("")
                : '<div class="terms">1)</div>'}
            </div>
            <div class="sign">
              <span>${escapeHtml(labels.buyerSignature)}</span>
              <span>${escapeHtml(labels.forLabel)} : ${escapeHtml(businessName || bill.businessName || "")}</span>
            </div>
            <p class="copyright">Copyright &copy; ${new Date().getFullYear()} Soman Tech Foundry. All rights reserved.</p>
          </div>
        </div>
        <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};</script>
      </body>
    </html>
  `;

  return openAndPrint(html, windowSize);
}

function printThermalBill(bill, profile, billProfile = {}) {
  const currency = profile?.currency || "INR";
  const locale = profile?.locale || "en-IN";
  const labels = getPrintLabels(locale);
  const orderLabel = bill.orderType === "wholesale" ? labels.wholesale : labels.retail;
  const headerTitle = billProfile?.businessName || bill.businessName || "Soman Tech Foundry";
  const subTitle = billProfile?.businessDescription || "";
  const address = billProfile?.address || "";
  const city = billProfile?.city || "";
  const gstin = billProfile?.gstin || "-";
  const plNo = billProfile?.plNo || "-";
  const slNo = billProfile?.slNo || "-";
  const retailDate = bill.createdAtText || new Date().toLocaleString(locale);
  const customerName = bill.customerName || labels.walkIn;
  const disclaimer = String(billProfile?.disclaimer || "").trim();
  const formatSpec = (unitSize, unitType) => {
    const size = Number(unitSize || 1);
    const type = String(unitType || "pcs");
    if (type === "pcs") return "Nos";
    if (!Number.isFinite(size) || size <= 0) return type;
    const normalized = Number.isInteger(size) ? String(size) : String(size);
    return `${normalized}${type}`;
  };
  const taxableTotal = Number(bill.netTotal || 0);
  const sgst = taxableTotal * 0.025;
  const cgst = taxableTotal * 0.025;
  const grandTotal = taxableTotal + sgst + cgst;
  const linesHtml = bill.items.map((item) => {
    const lineTotal = Number(item.qty) * Number(item.salePrice);
    return `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td class="center">${escapeHtml(formatSpec(item.unitSize, item.unitType))}</td>
        <td class="center">${escapeHtml(String(item.qty))}</td>
        <td class="right">${escapeHtml(formatCurrency(lineTotal, currency, locale))}</td>
      </tr>
    `;
  }).join("");

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Bill #${escapeHtml(bill.billNo)}</title>
        <style>
          body{font-family:Arial,sans-serif;margin:0;padding:8px;color:#111}
          .sheet{width:280px}
          h2{font-size:13px;margin:0 0 3px;text-align:center;line-height:1.2}
          p{margin:1px 0;font-size:10px}
          .center{text-align:center}
          .retail-meta-wrap{margin-top:4px;display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:start}
          .retail-meta-left{display:grid;justify-items:start;gap:1px}
          .retail-meta-left p{margin:0;font-size:9px;text-align:left}
          .retail-meta-right{display:grid;justify-items:end;gap:1px}
          .retail-meta-right p{margin:0;font-size:9px;text-align:right}
          table{width:100%;border-collapse:collapse;margin-top:6px;font-size:11px}
          th,td{border-bottom:1px dashed #777;padding:4px 2px;text-align:left}
          th{font-size:10px}
          .right{text-align:right}
          .totals{margin-top:8px;border-top:1px dashed #777;padding-top:6px;display:grid;gap:3px}
          .tot-row{display:flex;justify-content:space-between;font-size:10px}
          .tot-row strong{font-size:11px}
          .retail-disclaimer{margin-top:10px;text-align:center}
          .retail-disclaimer h4{
            margin:0 0 4px;
            font-size:10px;
            text-decoration:underline;
            letter-spacing:.4px;
          }
          .retail-disclaimer p{margin:0;font-size:10px;line-height:1.3}
          @media print { body{padding:0} }
        </style>
      </head>
      <body>
        <div class="sheet">
          <h2>${escapeHtml(String(headerTitle).toUpperCase())}</h2>
          ${subTitle ? `<p class="center">${escapeHtml(subTitle)}</p>` : ""}
          ${address ? `<p class="center">${escapeHtml(address)}</p>` : ""}
          ${city ? `<p class="center">${escapeHtml(city)}</p>` : ""}
          <div class="retail-meta-wrap">
            <div class="retail-meta-left">
              <p>${escapeHtml(orderLabel)}</p>
              <p>${escapeHtml(labels.billNo)}: #${escapeHtml(bill.billNo)}</p>
              <p>${escapeHtml(labels.date)}: ${escapeHtml(retailDate)}</p>
              <p>${escapeHtml(labels.customer)}: ${escapeHtml(customerName)}</p>
            </div>
            <div class="retail-meta-right">
              <p>${escapeHtml(labels.plNo)}: ${escapeHtml(plNo)}</p>
              <p>${escapeHtml(labels.slNo)}: ${escapeHtml(slNo)}</p>
              <p>${escapeHtml(labels.gstin)}: ${escapeHtml(gstin)}</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(labels.item)}</th>
                <th class="center">${escapeHtml(labels.spec)}</th>
                <th class="center">${escapeHtml(labels.qty)}</th>
                <th class="right">${escapeHtml(labels.amount)}</th>
              </tr>
            </thead>
            <tbody>${linesHtml}</tbody>
          </table>
          <div class="totals">
            <div class="tot-row"><span>${escapeHtml(labels.total)}</span><span>${escapeHtml(formatCurrency(taxableTotal, currency, locale))}</span></div>
            <div class="tot-row"><span>${escapeHtml(labels.sgst)}</span><span>${escapeHtml(formatCurrency(sgst, currency, locale))}</span></div>
            <div class="tot-row"><span>${escapeHtml(labels.cgst)}</span><span>${escapeHtml(formatCurrency(cgst, currency, locale))}</span></div>
            <div class="tot-row"><strong>${escapeHtml(labels.grandTotal)}</strong><strong>${escapeHtml(formatCurrency(grandTotal, currency, locale))}</strong></div>
          </div>
          ${disclaimer ? `<div class="retail-disclaimer"><h4>${escapeHtml(labels.disclaimer)}</h4><p>${escapeHtml(disclaimer)}</p></div>` : ""}
        </div>
        <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};</script>
      </body>
    </html>
  `;

  return openAndPrint(html, "width=420,height=640");
}

export function printRetailBillByTemplate(bill, profile, billProfile) {
  if (bill?.orderType === "wholesale") {
    return printWholesaleFormat(bill, profile, billProfile);
  }

  if (bill?.orderType === "retail") {
    return printThermalBill(bill, profile, billProfile);
  }

  return printThermalBill(bill, profile, billProfile);
}


