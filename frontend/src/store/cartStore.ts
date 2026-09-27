import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PurchaseMode = "retail" | "wholesale";

export interface CartItem {
  /** Stable identity for a product+purchase-mode pair, e.g. `abc-retail`. */
  cartLineId: string;
  productId: string;
  name: string;
  brand?: string;
  image?: string;
  purchaseMode: PurchaseMode;
  quantity: number;
  /**
   * Effective unit price for the line. The API resolves retail vs wholesale
   * pricing, so this is never derived in the browser.
   */
  unitPrice: number;
  /** Quantity at which this product's wholesale tier starts, when it has one. */
  wholesaleMinQty?: number;
}

export interface AddCartItemInput {
  productId: string;
  name: string;
  unitPrice: number;
  purchaseMode: PurchaseMode;
  quantity?: number;
  brand?: string;
  image?: string;
  wholesaleMinQty?: number;
}

interface CartState {
  items: CartItem[];

  addItem: (input: AddCartItemInput) => void;
  removeItem: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  clearCart: () => void;
}

export function cartLineId(productId: string, purchaseMode: PurchaseMode): string {
  return `${productId}-${purchaseMode}`;
}

export const selectCartCount = (items: CartItem[]): number =>
  items.reduce((sum, item) => sum + item.quantity, 0);

export const selectCartSubtotal = (items: CartItem[]): number =>
  items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

export const selectHasWholesaleLine = (items: CartItem[]): boolean =>
  items.some((item) => item.purchaseMode === "wholesale");

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],

      addItem: (input) =>
        set((state) => {
          const quantity = input.quantity ?? 1;
          const lineId = cartLineId(input.productId, input.purchaseMode);
          const existing = state.items.find((item) => item.cartLineId === lineId);

          if (existing) {
            return {
              items: state.items.map((item) =>
                item.cartLineId === lineId
                  ? {
                      ...item,
                      quantity: item.quantity + quantity,
                      unitPrice: input.unitPrice,
                    }
                  : item,
              ),
            };
          }

          const item: CartItem = {
            cartLineId: lineId,
            productId: input.productId,
            name: input.name,
            purchaseMode: input.purchaseMode,
            quantity,
            unitPrice: input.unitPrice,
            ...(input.brand === undefined ? {} : { brand: input.brand }),
            ...(input.image === undefined ? {} : { image: input.image }),
            ...(input.wholesaleMinQty === undefined
              ? {}
              : { wholesaleMinQty: input.wholesaleMinQty }),
          };

          return { items: [...state.items, item] };
        }),

      removeItem: (lineId) =>
        set((state) => ({
          items: state.items.filter((item) => item.cartLineId !== lineId),
        })),

      updateQuantity: (lineId, quantity) =>
        set((state) => {
          if (quantity < 1) {
            return { items: state.items.filter((item) => item.cartLineId !== lineId) };
          }

          return {
            items: state.items.map((item) =>
              item.cartLineId === lineId ? { ...item, quantity } : item,
            ),
          };
        }),

      clearCart: () => set({ items: [] }),
    }),
    {
      // v2: the pre-shop cart stored `{ id, name, price, qty }` under
      // `denthub-cart`. The new key deliberately orphans that payload rather
      // than migrating it, because the shapes are not compatible.
      name: "denthub-cart-v2",
      version: 1,
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
