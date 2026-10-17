import { useEffect, useMemo, useState } from "react";
import { extractApiError } from "../../../api/client";
import { fetchCustomers } from "../../../api/customerApi";
import { fetchProducts } from "../../../api/productApi";
import { fetchCurrentPrintTemplate } from "../../../api/printTemplateApi";
import { createSale } from "../../../api/salesApi";
import { useI18n } from "../../../i18n/useI18n";
import { useAuthStore } from "../../../store/authStore";
import { usePosStore } from "../../../store/posStore";
import PurchaseOrdersPage from "../../purchaseOrders/pages/PurchaseOrdersPage";
import { INVENTORY_LOCATIONS, getLocationLabel, getLocationQty } from "../../../domain/inventoryLocations";
import { printRetailBillByTemplate } from "../../../utils/printTemplates";
import { formatCurrency, getBusinessProfile } from "../../../utils/formatters";

function formatUnitLabel(unitSize, unitType) {
  if (!unitSize || (Number(unitSize) === 1 && unitType === "pcs")) return "pcs";
  return `${unitSize}${unitType}`;
}

function pickCheapestVariantId(variants) {
  if (!variants || variants.length === 0) return "";
  return [...variants]
    .sort((a, b) => (Number(a.salePrice) || 0) - (Number(b.salePrice) || 0))
    .map((variant) => variant.id)[0];
}

function mapProducts(productsData) {
  return productsData.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    variants: (item.variants || []).map((variant) => ({
      id: variant.id,
      productId: item.id,
      name: item.name,
      sku: variant.sku,
      unitType: variant.unit_type || "pcs",
      unitSize: Number(variant.unit_size || 1),
      stock: Number(variant.stock_qty || 0),
      locationStocks: Array.isArray(variant.location_stocks) ? variant.location_stocks : [],
      salePrice: Number(variant.sale_price || 0)
    }))
  }));
}

function POSPage() {
  const profile = getBusinessProfile();
  const { t, language } = useI18n();
  const { user } = useAuthStore();
  const { cart, addToCart, updateQty, clearCart } = usePosStore();
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successText, setSuccessText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [posMode, setPosMode] = useState("retail");
  const [orderType, setOrderType] = useState("retail");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [sourceLocationCode, setSourceLocationCode] = useState("main_store");
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [wholesaleTinNo, setWholesaleTinNo] = useState("");
  const [wholesaleFlPlSlNo, setWholesaleFlPlSlNo] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerMenuOpen, setCustomerMenuOpen] = useState(false);
  const [variantSelection, setVariantSelection] = useState({});
  const [showPrintPrompt, setShowPrintPrompt] = useState(false);
  const [pendingPrintBill, setPendingPrintBill] = useState(null);
  const [billProfile, setBillProfile] = useState({});

  useEffect(() => {
    let mounted = true;

    async function loadInitial() {
      try {
        const [productsData, customersData, currentTemplate] = await Promise.all([
          fetchProducts(),
          fetchCustomers(),
          fetchCurrentPrintTemplate().catch(() => ({ billProfile: {} }))
        ]);
        if (!mounted) return;
        setBillProfile(currentTemplate?.billProfile || {});

        const mappedProducts = mapProducts(productsData);
        setProducts(mappedProducts);

        setVariantSelection((prev) => {
          const next = { ...prev };
          mappedProducts.forEach((product) => {
            if (!next[product.id] && product.variants.length > 0) {
              next[product.id] = pickCheapestVariantId(product.variants);
            }
          });
          return next;
        });

        setCustomers(
          customersData.map((item) => ({
            id: item.id,
            name: item.name,
            address: item.address || "",
            mobile: item.mobile || "",
            email: item.email || ""
          }))
        );
      } catch (err) {
        if (mounted) {
          setError(extractApiError(err, t("pos.failedLoad")));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadInitial();

    return () => {
      mounted = false;
    };
  }, [language]);

  const cartQtyByVariant = useMemo(() => {
    return cart.reduce((acc, item) => {
      acc[item.id] = item.qty;
      return acc;
    }, {});
  }, [cart]);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return products;

    return products.filter((product) =>
      product.name.toLowerCase().includes(term) ||
      product.variants.some((variant) => variant.sku.toLowerCase().includes(term))
    );
  }, [products, searchTerm]);

  const customerMatches = useMemo(() => {
    const term = customerName.trim().toLowerCase();
    if (!term) return customers.slice(0, 6);

    return customers
      .filter((customer) => (
        customer.name.toLowerCase().includes(term) ||
        customer.mobile.toLowerCase().includes(term) ||
        customer.email.toLowerCase().includes(term)
      ))
      .slice(0, 6);
  }, [customerName, customers]);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.salePrice * item.qty, 0), [cart]);
  const safeDiscount = Math.min(Number(discount) || 0, subtotal);
  const total = Math.max(subtotal - safeDiscount, 0);

  function getCartQty(variantId) {
    return cartQtyByVariant[variantId] || 0;
  }

  function selectVariant(productId, variantId) {
    setVariantSelection((prev) => ({ ...prev, [productId]: variantId }));
  }

  function handleAdd(variant) {
    const locationQty = getLocationQty(variant.locationStocks, sourceLocationCode);
    if (getCartQty(variant.id) >= locationQty) return;
    addToCart(variant);
  }

  function increaseQty(item) {
    const sourceVariant = products
      .flatMap((product) => product.variants)
      .find((variant) => variant.id === item.id);
    if (!sourceVariant) return;
    const locationQty = getLocationQty(sourceVariant.locationStocks, sourceLocationCode);
    if (item.qty >= locationQty) return;
    updateQty(item.id, item.qty + 1);
  }

  function decreaseQty(item) {
    updateQty(item.id, item.qty - 1);
  }

  function handleCustomerInputChange(value) {
    setCustomerName(value);

    const normalized = value.trim().toLowerCase();
    const exactMatch = customers.find((customer) => (
      customer.name.trim().toLowerCase() === normalized ||
      customer.mobile.trim().toLowerCase() === normalized ||
      customer.email.trim().toLowerCase() === normalized
    ));

    if (exactMatch) {
      setSelectedCustomerId(exactMatch.id);
      setCustomerName(exactMatch.name);
      setCustomerMenuOpen(false);
      return;
    }

    setSelectedCustomerId("");
    if (!customerMenuOpen) {
      setCustomerMenuOpen(true);
    }
  }

  function selectCustomer(customer) {
    setCustomerName(customer.name);
    setSelectedCustomerId(customer.id);
    setCustomerMenuOpen(false);
  }

  async function refreshCustomers() {
    const customersData = await fetchCustomers();
    setCustomers(
      customersData.map((item) => ({
        id: item.id,
        name: item.name,
        address: item.address || "",
        mobile: item.mobile || "",
        email: item.email || ""
      }))
    );
  }

  async function refreshProducts() {
    const refreshed = await fetchProducts();
    const mappedProducts = mapProducts(refreshed);

    setProducts(mappedProducts);

    setVariantSelection((prev) => {
      const next = { ...prev };
      mappedProducts.forEach((product) => {
        if (!next[product.id] && product.variants.length > 0) {
          next[product.id] = pickCheapestVariantId(product.variants);
        }
      });
      return next;
    });
  }

  async function handleCheckout() {
    if (cart.length === 0 || !user) return;

    setSubmitting(true);
    setError("");
    setSuccessText("");

    try {
      const payload = {
        orderType,
        sourceLocationCode,
        paymentMode,
        discount: safeDiscount,
        notes,
        wholesaleTinNo: orderType === "wholesale" ? wholesaleTinNo.trim() : "",
        wholesaleFlPlSlNo: orderType === "wholesale" ? wholesaleFlPlSlNo.trim() : "",
        createdBy: user.name,
        items: cart.map((item) => ({ variantId: item.id, qty: item.qty }))
      };

      if (selectedCustomerId) {
        payload.customerId = selectedCustomerId;
      } else if (customerName.trim()) {
        payload.customer = { name: customerName.trim() };
      }

      if (orderType === "wholesale" && !payload.customerId && !payload.customer?.name) {
        throw new Error(t("pos.customerMandatory"));
      }

      const sale = await createSale(payload);
      const billNo = sale.bill_no || sale.bill_no === 0 ? sale.bill_no : sale.id;
      setSuccessText(t("pos.saleCreated", { billNo }));

      const customerDisplayName = selectedCustomerId
        ? (customers.find((customer) => customer.id === selectedCustomerId)?.name || customerName.trim() || t("common.walkIn"))
        : (customerName.trim() || t("common.walkIn"));

      const printableBill = {
        billNo,
        createdAtText: sale.created_at ? new Date(sale.created_at).toLocaleString(profile.locale) : new Date().toLocaleString(profile.locale),
        businessName: user.businessName || "Soman Tech Foundry",
        customerName: customerDisplayName,
        orderType,
        paymentMode,
        sourceLocationLabel: getLocationLabel(sourceLocationCode, t),
        createdBy: user.name,
        wholesaleTinNo: sale.wholesale_tin_no || (orderType === "wholesale" ? wholesaleTinNo.trim() : ""),
        wholesaleFlPlSlNo: sale.wholesale_fl_pl_sl_no || (orderType === "wholesale" ? wholesaleFlPlSlNo.trim() : ""),
        items: cart.map((item) => ({
          name: item.name,
          unitType: item.unitType,
          unitSize: item.unitSize,
          qty: item.qty,
          salePrice: item.salePrice
        })),
        subtotal,
        discount: safeDiscount,
        netTotal: total,
        notes
      };

      clearCart();
      setDiscount(0);
      setNotes("");
      setWholesaleTinNo("");
      setWholesaleFlPlSlNo("");
      setCustomerName("");
      setSelectedCustomerId("");

      await Promise.all([refreshProducts(), refreshCustomers()]);
      setPendingPrintBill(printableBill);
      setShowPrintPrompt(true);
    } catch (err) {
      setError(extractApiError(err, t("pos.checkoutFailed")));
    } finally {
      setSubmitting(false);
    }
  }

  function handlePrintNow() {
    if (!pendingPrintBill) {
      setShowPrintPrompt(false);
      return;
    }
    printRetailBillByTemplate(pendingPrintBill, profile, billProfile);
    setShowPrintPrompt(false);
    setPendingPrintBill(null);
  }

  function handlePrintSkip() {
    setShowPrintPrompt(false);
    setPendingPrintBill(null);
  }

  function renderModeToggle() {
    return (
      <div className="order-type-toggle">
        <button
          type="button"
          className={posMode === "retail" ? "" : "ghost"}
          onClick={() => {
            setPosMode("retail");
            setOrderType("retail");
          }}
        >
          {t("pos.modeRetail")}
        </button>
        <button
          type="button"
          className={posMode === "wholesale" ? "" : "ghost"}
          onClick={() => {
            setPosMode("wholesale");
            setOrderType("wholesale");
          }}
        >
          {t("pos.modeWholesale")}
        </button>
        <button
          type="button"
          className={posMode === "purchase" ? "" : "ghost"}
          onClick={() => setPosMode("purchase")}
        >
          {t("pos.modePurchase")}
        </button>
      </div>
    );
  }

  return (
    <div>

      {posMode === "purchase" ? (
        <PurchaseOrdersPage embedded modeToggle={renderModeToggle()} />
      ) : (
        <div className="pos-workspace split-layout">
      {showPrintPrompt && (
        <div className="modal-backdrop">
          <div className="card modal-card">
            <h3>{t("pos.printTitle")}</h3>
            <p className="muted">{t("pos.printPrompt", { type: orderType === "wholesale" ? t("pos.modeWholesale") : t("pos.modeRetail") })}</p>
            <div className="actions">
              <button type="button" className="ghost" onClick={handlePrintSkip}>{t("common.skip")}</button>
              <button type="button" onClick={handlePrintNow}>{t("pos.printNow")}</button>
            </div>
          </div>
        </div>
      )}

      <section>
        <div className="pos-header-row">
          <div>
            <h2>{t("pos.title")}</h2>
            <p className="muted">{t("pos.subtitle")}</p>
            {renderModeToggle()}
          </div>
          <div className="pos-quick-stats card compact">
            <p className="small muted">{t("pos.itemsInCart")}</p>
            <strong>{cart.length}</strong>
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}
        {successText && <p className="success-text">{successText}</p>}

        <div className="card compact pos-search-wrap">
          <input
            type="text"
            placeholder={t("pos.searchProducts")}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        {loading ? (
          <p className="muted">{t("pos.loadingProducts")}</p>
        ) : (
          <div className="product-grid pos-product-grid">
            {filteredProducts.map((product) => {
              const selectedVariantId = variantSelection[product.id] || pickCheapestVariantId(product.variants);
              const selectedVariant = product.variants.find((variant) => variant.id === selectedVariantId) || product.variants[0];

              return (
                <article key={product.id} className="card compact pos-product-card">
                  <div>
                    <h4>{product.name}</h4>
                    <p className="muted small">{product.category}</p>
                  </div>

                  <div className="variant-picker">
                    {product.variants.map((variant) => {
                      const unitLabel = formatUnitLabel(variant.unitSize, variant.unitType);
                      const isActive = variant.id === selectedVariantId;
                      const locationQty = getLocationQty(variant.locationStocks, sourceLocationCode);
                      const isOut = locationQty <= 0;

                      return (
                        <button
                          key={variant.id}
                          type="button"
                          className={`variant-pill${isActive ? " active" : ""}${isOut ? " out" : ""}`}
                          onClick={() => selectVariant(product.id, variant.id)}
                          disabled={isOut}
                        >
                          {unitLabel}
                          {isOut && <span className="variant-out">{t("common.out")}</span>}
                        </button>
                      );
                    })}
                  </div>

                  {selectedVariant && (
                    <div className="variant-summary">
                      <p className="muted small">
                        {t("products.skuLabel")} {selectedVariant.sku} - {t("pos.stockAtLocation", { location: getLocationLabel(sourceLocationCode), qty: getLocationQty(selectedVariant.locationStocks, sourceLocationCode) })}
                      </p>
                      <div className="variant-actions">
                        <span>{formatCurrency(selectedVariant.salePrice, profile.currency, profile.locale)}</span>
                        <button
                          onClick={() => handleAdd(selectedVariant)}
                          disabled={getCartQty(selectedVariant.id) >= getLocationQty(selectedVariant.locationStocks, sourceLocationCode)}
                        >
                          {getCartQty(selectedVariant.id) < getLocationQty(selectedVariant.locationStocks, sourceLocationCode) ? t("pos.add") : t("pos.stockLimit")}
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="card pos-bill-card">
        <h3>{t("pos.currentBill")}</h3>

        {cart.length === 0 && <p className="muted">{t("pos.noItems")}</p>}
        {cart.map((item) => (
          <div key={item.id} className="line-item pos-line-item">
            <div>
              <p>{item.name}</p>
              <p className="muted small">{formatUnitLabel(item.unitSize, item.unitType)} - {formatCurrency(item.salePrice, profile.currency, profile.locale)} {t("common.each")}</p>
            </div>

            <div className="qty-stepper">
              <button type="button" className="ghost" onClick={() => decreaseQty(item)}>-</button>
              <span>{item.qty}</span>
              <button type="button" className="ghost" onClick={() => increaseQty(item)}>+</button>
            </div>

            <strong>{formatCurrency(item.qty * item.salePrice, profile.currency, profile.locale)}</strong>
          </div>
        ))}

        <div className="pos-checkout-config">
          <label>{t("customers.customerName")}</label>
          <div className="combo-box">
            <input
              type="text"
              placeholder={orderType === "wholesale" ? t("pos.customerRequiredWholesale") : t("pos.searchCustomer")}
              value={customerName}
              onChange={(event) => handleCustomerInputChange(event.target.value)}
              onFocus={() => setCustomerMenuOpen(true)}
              onBlur={() => setTimeout(() => setCustomerMenuOpen(false), 120)}
            />
            {customerMenuOpen && customerMatches.length > 0 && (
              <div className="combo-menu">
                {customerMatches.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    className="combo-option"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      selectCustomer(customer);
                    }}
                  >
                    <span className="combo-title">{customer.name}</span>
                    <span className="combo-sub">{customer.mobile || "-"} - {customer.email || "-"}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {orderType === "wholesale" && !customerName.trim() && (
            <p className="error-text small">{t("pos.customerMandatory")}</p>
          )}

          <label>{t("purchase.paymentMode")}</label>
          <select value={paymentMode} onChange={(event) => setPaymentMode(event.target.value)}>
            <option value="cash">{t("payment.cash")}</option>
            <option value="upi">{t("payment.upi")}</option>
            <option value="card">{t("payment.card")}</option>
            <option value="credit">{t("payment.credit")}</option>
          </select>

          {orderType === "wholesale" && (
            <>
          <label>{t("bill.tinNo")}</label>
              <input
                type="text"
                placeholder={t("bill.enterTinNo")}
                value={wholesaleTinNo}
                onChange={(event) => setWholesaleTinNo(event.target.value)}
              />
              <label>{t("bill.flPlSlNo")}</label>
              <input
                type="text"
                placeholder={t("bill.enterFlPlSlNo")}
                value={wholesaleFlPlSlNo}
                onChange={(event) => setWholesaleFlPlSlNo(event.target.value)}
              />
            </>
          )}

          <label>{t("pos.sellFrom")}</label>
          <select value={sourceLocationCode} onChange={(event) => setSourceLocationCode(event.target.value)}>
            {INVENTORY_LOCATIONS.map((location) => (
              <option key={location.code} value={location.code}>{t(location.labelKey)}</option>
            ))}
          </select>

          <label>{t("dashboard.discount")}</label>
          <input
            type="number"
            min="0"
            max={subtotal}
            value={discount}
            onChange={(event) => setDiscount(Number(event.target.value) || 0)}
          />

          <label>{t("purchase.notes")}</label>
          <input
            type="text"
            placeholder={t("pos.notesPlaceholder")}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        <hr />
        <div className="line-item pos-total-line">
          <span>{t("pos.subtotal")}</span>
          <strong>{formatCurrency(subtotal, profile.currency, profile.locale)}</strong>
        </div>
        <div className="line-item pos-total-line">
          <span>{t("dashboard.discount")}</span>
          <strong>{formatCurrency(safeDiscount, profile.currency, profile.locale)}</strong>
        </div>
        <div className="line-item pos-total-line grand-total">
          <strong>{t("pos.total")}</strong>
          <strong>{formatCurrency(total, profile.currency, profile.locale)}</strong>
        </div>

        <div className="actions">
          <button className="ghost" onClick={clearCart}>{t("pos.clear")}</button>
          <button disabled={cart.length === 0 || submitting} onClick={handleCheckout}>
            {submitting ? t("pos.processing") : t("pos.checkout")}
          </button>
        </div>
      </section>
        </div>
      )}
    </div>
  );
}

export default POSPage;

