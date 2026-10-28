"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, extractApiError } from "@/lib/client/api";
import { getStoredUser, type AuthUser } from "@/lib/client/auth";
import {
  formatCurrency,
  formatUnitLabel,
  getLocationQty,
  INVENTORY_LOCATIONS,
} from "@/lib/client/format";

type LocationStock = { location_code?: string; qty?: number };

type Variant = {
  id: string;
  productId: string;
  name: string;
  sku: string;
  unitType: string;
  unitSize: number;
  stock: number;
  locationStocks: LocationStock[];
  salePrice: number;
  costPrice: number;
};

type Product = {
  id: string;
  name: string;
  category: string;
  variants: Variant[];
};

type CartItem = Variant & { qty: number };

type Customer = { id: string; name: string; mobile?: string; email?: string };

type PosMode = "retail" | "wholesale" | "purchase";

function pickDefaultVariantId(variants: Variant[], mode: PosMode) {
  if (!variants.length) return "";
  const sorted = [...variants].sort((a, b) =>
    mode === "purchase"
      ? (a.costPrice || 0) - (b.costPrice || 0)
      : (a.salePrice || 0) - (b.salePrice || 0),
  );
  return sorted[0]?.id || "";
}

function mapProducts(data: Array<Record<string, unknown>>): Product[] {
  return data.map((item) => ({
    id: String(item.id),
    name: String(item.name || ""),
    category: String(item.category || ""),
    variants: ((item.variants as Array<Record<string, unknown>>) || []).map((variant) => ({
      id: String(variant.id),
      productId: String(item.id),
      name: String(item.name || ""),
      sku: String(variant.sku || ""),
      unitType: String(variant.unit_type || "pcs"),
      unitSize: Number(variant.unit_size || 1),
      stock: Number(variant.stock_qty || 0),
      locationStocks: Array.isArray(variant.location_stocks)
        ? (variant.location_stocks as LocationStock[])
        : [],
      salePrice: Number(variant.sale_price || 0),
      costPrice: Number(variant.cost_price || 0),
    })),
  }));
}

export default function POSPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [posMode, setPosMode] = useState<PosMode>("retail");
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "card" | "credit">("cash");
  const [sourceLocationCode, setSourceLocationCode] = useState("main_store");
  const [receiveLocationCode, setReceiveLocationCode] = useState("godown");
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [wholesaleTinNo, setWholesaleTinNo] = useState("");
  const [wholesaleFlPlSlNo, setWholesaleFlPlSlNo] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [variantSelection, setVariantSelection] = useState<Record<string, string>>({});

  async function loadData() {
    const [productsData, customersData] = await Promise.all([
      apiFetch<Array<Record<string, unknown>>>("/api/products"),
      apiFetch<Array<Record<string, unknown>>>("/api/customers").catch(() => []),
    ]);
    const mapped = mapProducts(productsData);
    setProducts(mapped);
    setVariantSelection((prev) => {
      const next = { ...prev };
      mapped.forEach((product) => {
        if (!next[product.id] && product.variants.length) {
          next[product.id] = pickDefaultVariantId(product.variants, posMode);
        }
      });
      return next;
    });
    setCustomers(
      customersData.map((item) => ({
        id: String(item.id),
        name: String(item.name || ""),
        mobile: String(item.mobile || ""),
        email: String(item.email || ""),
      })),
    );
  }

  useEffect(() => {
    setUser(getStoredUser());
    let mounted = true;
    async function init() {
      try {
        await loadData();
      } catch (err) {
        if (mounted) setError(extractApiError(err, "Failed to load POS data"));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void init();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(term) ||
        product.variants.some((variant) => variant.sku.toLowerCase().includes(term)),
    );
  }, [products, searchTerm]);

  const cartQtyByVariant = useMemo(() => {
    return cart.reduce<Record<string, number>>((acc, item) => {
      acc[item.id] = item.qty;
      return acc;
    }, {});
  }, [cart]);

  const unitPriceKey = posMode === "purchase" ? "costPrice" : "salePrice";
  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item[unitPriceKey] * item.qty, 0),
    [cart, unitPriceKey],
  );
  const safeDiscount = Math.min(Number(discount) || 0, subtotal);
  const total = Math.max(subtotal - (posMode === "purchase" ? 0 : safeDiscount), 0);

  function getCartQty(variantId: string) {
    return cartQtyByVariant[variantId] || 0;
  }

  function addToCart(variant: Variant) {
    const locationCode = posMode === "purchase" ? receiveLocationCode : sourceLocationCode;
    const locationQty =
      posMode === "purchase" ? Number.POSITIVE_INFINITY : getLocationQty(variant.locationStocks, locationCode);
    if (getCartQty(variant.id) >= locationQty) return;

    setCart((prev) => {
      const existing = prev.find((item) => item.id === variant.id);
      if (existing) {
        return prev.map((item) =>
          item.id === variant.id ? { ...item, qty: item.qty + 1 } : item,
        );
      }
      return [...prev, { ...variant, qty: 1 }];
    });
  }

  function updateQty(variantId: string, qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((item) => item.id !== variantId));
      return;
    }
    setCart((prev) => prev.map((item) => (item.id === variantId ? { ...item, qty } : item)));
  }

  function clearCart() {
    setCart([]);
    setDiscount(0);
    setNotes("");
    setWholesaleTinNo("");
    setWholesaleFlPlSlNo("");
    setCustomerName("");
    setSelectedCustomerId("");
    setSupplierName("");
  }

  function switchMode(mode: PosMode) {
    setPosMode(mode);
    clearCart();
    setError("");
    setSuccess("");
  }

  async function handleCheckout() {
    if (!cart.length || !user) return;
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      if (posMode === "purchase") {
        await apiFetch("/api/purchase-orders", {
          method: "POST",
          body: JSON.stringify({
            supplierName: supplierName.trim(),
            receiveLocationCode,
            paymentMode,
            notes,
            createdBy: user.name,
            items: cart.map((item) => ({ variantId: item.id, qty: item.qty })),
          }),
        });
        setSuccess("Purchase order created");
      } else {
        const payload: Record<string, unknown> = {
          orderType: posMode,
          sourceLocationCode,
          paymentMode,
          discount: safeDiscount,
          notes,
          wholesaleTinNo: posMode === "wholesale" ? wholesaleTinNo.trim() : "",
          wholesaleFlPlSlNo: posMode === "wholesale" ? wholesaleFlPlSlNo.trim() : "",
          createdBy: user.name,
          items: cart.map((item) => ({ variantId: item.id, qty: item.qty })),
        };

        if (selectedCustomerId) {
          payload.customerId = selectedCustomerId;
        } else if (customerName.trim()) {
          payload.customer = { name: customerName.trim() };
        }

        if (posMode === "wholesale" && !payload.customerId && !(payload.customer as { name?: string })?.name) {
          throw new Error("Customer is required for wholesale sales");
        }

        const sale = await apiFetch<{ bill_no?: number; id?: string }>("/api/sales", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSuccess(`Sale created — bill #${sale.bill_no ?? sale.id}`);
      }

      clearCart();
      await loadData();
    } catch (err) {
      setError(extractApiError(err, "Checkout failed"));
    } finally {
      setSubmitting(false);
    }
  }

  const modeButtons: Array<{ id: PosMode; label: string }> = [
    { id: "retail", label: "Retail" },
    { id: "wholesale", label: "Wholesale" },
    { id: "purchase", label: "Purchase" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="page-title">Point of sale</h2>
          <p className="page-subtitle">Mobile-friendly catalog and bill checkout.</p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          {modeButtons.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                posMode === mode.id ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
              onClick={() => switchMode(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {success && <p className="success-text">{success}</p>}

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="space-y-3">
          <div className="card p-3">
            <input
              className="input"
              placeholder="Search products or SKU"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Loading products…</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredProducts.map((product) => {
                const selectedId =
                  variantSelection[product.id] || pickDefaultVariantId(product.variants, posMode);
                const selected =
                  product.variants.find((variant) => variant.id === selectedId) || product.variants[0];
                if (!selected) return null;

                const locationCode = posMode === "purchase" ? receiveLocationCode : sourceLocationCode;
                const available =
                  posMode === "purchase"
                    ? selected.stock
                    : getLocationQty(selected.locationStocks, locationCode);
                const inCart = getCartQty(selected.id);
                const price = posMode === "purchase" ? selected.costPrice : selected.salePrice;

                return (
                  <article key={product.id} className="card flex flex-col gap-3 p-4">
                    <div>
                      <h3 className="font-semibold text-slate-900">{product.name}</h3>
                      <p className="text-xs text-slate-500">{product.category}</p>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {product.variants.map((variant) => {
                        const locQty =
                          posMode === "purchase"
                            ? variant.stock
                            : getLocationQty(variant.locationStocks, locationCode);
                        const active = variant.id === selected.id;
                        return (
                          <button
                            key={variant.id}
                            type="button"
                            className={`rounded-md border px-2 py-1 text-xs ${
                              active
                                ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                                : "border-slate-200 text-slate-600"
                            } ${locQty <= 0 && posMode !== "purchase" ? "opacity-50" : ""}`}
                            onClick={() =>
                              setVariantSelection((prev) => ({ ...prev, [product.id]: variant.id }))
                            }
                          >
                            {formatUnitLabel(variant.unitSize, variant.unitType)}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-900">{formatCurrency(price)}</span>
                      <span className="text-slate-500">
                        {posMode === "purchase" ? `Stock ${available}` : `Avail ${available}`}
                      </span>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-2">
                      {inCart > 0 ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="btn-ghost h-9 w-9 px-0"
                            onClick={() => updateQty(selected.id, inCart - 1)}
                          >
                            −
                          </button>
                          <span className="min-w-8 text-center text-sm font-semibold">{inCart}</span>
                          <button
                            type="button"
                            className="btn-ghost h-9 w-9 px-0"
                            disabled={posMode !== "purchase" && inCart >= available}
                            onClick={() => addToCart(selected)}
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn w-full"
                          disabled={posMode !== "purchase" && available <= 0}
                          onClick={() => addToCart(selected)}
                        >
                          Add
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="card h-fit space-y-4 p-4 xl:sticky xl:top-20">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Bill</h3>
            <span className="text-sm text-slate-500">{cart.length} lines</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {posMode === "purchase" ? (
              <>
                <div>
                  <label className="label">Receive location</label>
                  <select
                    className="input"
                    value={receiveLocationCode}
                    onChange={(e) => setReceiveLocationCode(e.target.value)}
                  >
                    {INVENTORY_LOCATIONS.map((loc) => (
                      <option key={loc.code} value={loc.code}>
                        {loc.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Supplier</label>
                  <input
                    className="input"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="label">Source location</label>
                  <select
                    className="input"
                    value={sourceLocationCode}
                    onChange={(e) => setSourceLocationCode(e.target.value)}
                  >
                    {INVENTORY_LOCATIONS.map((loc) => (
                      <option key={loc.code} value={loc.code}>
                        {loc.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Customer</label>
                  <input
                    className="input"
                    list="pos-customers"
                    value={customerName}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCustomerName(value);
                      const match = customers.find(
                        (c) => c.name.toLowerCase() === value.trim().toLowerCase(),
                      );
                      setSelectedCustomerId(match?.id || "");
                    }}
                    placeholder={posMode === "wholesale" ? "Required" : "Walk-in"}
                  />
                  <datalist id="pos-customers">
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.name} />
                    ))}
                  </datalist>
                </div>
              </>
            )}

            <div>
              <label className="label">Payment</label>
              <select
                className="input"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as typeof paymentMode)}
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="credit">Credit</option>
              </select>
            </div>

            {posMode !== "purchase" && (
              <div>
                <label className="label">Discount</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                />
              </div>
            )}

            {posMode === "wholesale" && (
              <>
                <div>
                  <label className="label">TIN</label>
                  <input
                    className="input"
                    value={wholesaleTinNo}
                    onChange={(e) => setWholesaleTinNo(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">FL / PL / SL</label>
                  <input
                    className="input"
                    value={wholesaleFlPlSlNo}
                    onChange={(e) => setWholesaleFlPlSlNo(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea
              className="input min-h-20"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="max-h-56 space-y-2 overflow-y-auto scrollbar-thin">
            {cart.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{item.name}</p>
                  <p className="text-xs text-slate-500">
                    {formatUnitLabel(item.unitSize, item.unitType)} ·{" "}
                    {formatCurrency(item[unitPriceKey])}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="btn-ghost h-8 w-8 px-0"
                    onClick={() => updateQty(item.id, item.qty - 1)}
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-semibold">{item.qty}</span>
                  <button
                    type="button"
                    className="btn-ghost h-8 w-8 px-0"
                    onClick={() => updateQty(item.id, item.qty + 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
            {!cart.length && <p className="text-sm text-slate-500">Cart is empty.</p>}
          </div>

          <div className="space-y-1 border-t border-slate-100 pt-3 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {posMode !== "purchase" && (
              <div className="flex justify-between text-slate-600">
                <span>Discount</span>
                <span>-{formatCurrency(safeDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold text-slate-900">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button type="button" className="btn-ghost flex-1" onClick={clearCart} disabled={!cart.length}>
              Clear
            </button>
            <button
              type="button"
              className="btn flex-1"
              disabled={!cart.length || submitting}
              onClick={() => void handleCheckout()}
            >
              {submitting ? "Saving…" : posMode === "purchase" ? "Create PO" : "Checkout"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
