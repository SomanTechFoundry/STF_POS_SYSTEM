import { create } from "zustand";

export const usePosStore = create((set, get) => ({
  cart: [],
  addToCart: (variant) => {
    const cart = get().cart;
    const existing = cart.find((item) => item.id === variant.id);

    if (existing) {
      set({
        cart: cart.map((item) =>
          item.id === variant.id ? { ...item, qty: item.qty + 1 } : item
        )
      });
      return;
    }

    set({
      cart: [
        ...cart,
        {
          id: variant.id,
          productId: variant.productId,
          name: variant.name,
          sku: variant.sku,
          unitType: variant.unitType,
          unitSize: variant.unitSize,
          salePrice: Number(variant.salePrice),
          qty: 1
        }
      ]
    });
  },
  updateQty: (id, qty) => {
    if (qty <= 0) {
      set({ cart: get().cart.filter((item) => item.id !== id) });
      return;
    }

    set({
      cart: get().cart.map((item) => (item.id === id ? { ...item, qty } : item))
    });
  },
  clearCart: () => set({ cart: [] })
}));
