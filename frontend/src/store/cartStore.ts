import { create } from "zustand";
import { persist } from "zustand/middleware";

import { multiplyMoney, sumMoney } from "../utils/money";

export type PurchaseMode = "retail" | "wholesale";

export interface CartItem {
  /** One line per product: the product id doubles as the line id. */
  cartLineId: string;
  productId: string;
  name: string;
  supplierId: string;
  supplierName: string;
  /** The Supplier account's User id, the recipient for a shop conversation. */
  supplierUserId: string;
  brand?: string;
  image?: string;
  purchaseMode: PurchaseMode;
  quantity: number;
  /**
   * Effective unit price for the line, as the exact decimal string the API
   * returned. The API resolves retail vs wholesale pricing, so this is never
   * derived in the browser, and the cart sums it without a float round-trip.
   */
  unitPrice: string;
  /** Both API prices, kept so switching mode never derives a price in the browser. */
  retailUnitPrice: string;
  wholesaleUnitPrice?: string;
  /** Quantity at which this product's wholesale tier starts, when it has one. */
  wholesaleMinQty?: number;
  /**
   * Currency the API priced this line in, frozen at add time.
   *
   * Optional so carts persisted before this field existed still load; the
   * drawer falls back to the active region's currency.
   */
  currency?: string;
}

export interface AddCartItemInput {
  productId: string;
  name: string;
  supplierId: string;
  supplierName: string;
  supplierUserId: string;
  unitPrice: string;
  retailUnitPrice?: string;
  wholesaleUnitPrice?: string | null;
  purchaseMode: PurchaseMode;
  quantity?: number;
  brand?: string;
  image?: string;
  wholesaleMinQty?: number;
  currency?: string;
}

interface CartState {
  items: CartItem[];

  addItem: (input: AddCartItemInput) => void;
  removeItem: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  removeLines: (lineIds: string[]) => void;
  clearCart: () => void;
}

/** The subset of the store that is persisted, and the migrate() return type. */
type PersistedCart = Pick<CartState, "items">;

export function cartLineId(productId: string): string {
  return productId;
}

export const selectCartCount = (items: CartItem[]): number =>
  items.reduce((sum, item) => sum + item.quantity, 0);

export const selectCartSubtotal = (items: CartItem[]): string =>
  sumMoney(items.map((item) => multiplyMoney(item.unitPrice, item.quantity)));

export const selectHasWholesaleLine = (items: CartItem[]): boolean =>
  items.some((item) => item.purchaseMode === "wholesale");

/**
 * Currency to label the cart with: the first line the API priced, else the
 * caller's fallback. Lines added before this field existed carry no currency.
 */
export const selectCartCurrency = (items: CartItem[], fallback = "KES"): string =>
  items.find((item) => item.currency !== undefined)?.currency ?? fallback;

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],

      addItem: (input) =>
        set((state) => {
          const quantity = input.quantity ?? 1;
          const lineId = cartLineId(input.productId);
          const existing = state.items.find((item) => item.cartLineId === lineId);
          const retailUnitPrice = input.retailUnitPrice ?? input.unitPrice;
          const wholesaleUnitPrice =
            input.wholesaleUnitPrice ??
            (input.purchaseMode === "wholesale" ? input.unitPrice : undefined);
          const unitPrice =
            input.purchaseMode === "wholesale"
              ? (wholesaleUnitPrice ?? input.unitPrice)
              : retailUnitPrice;

          if (existing) {
            const sameMode = existing.purchaseMode === input.purchaseMode;

            return {
              items: state.items.map((item) =>
                item.cartLineId === lineId
                  ? {
                      ...item,
                      purchaseMode: input.purchaseMode,
                      quantity: sameMode ? item.quantity + quantity : quantity,
                      unitPrice,
                      retailUnitPrice,
                      wholesaleUnitPrice,
                      supplierId: input.supplierId,
                      supplierName: input.supplierName,
                      supplierUserId: input.supplierUserId,
                      ...(input.wholesaleMinQty === undefined
                        ? {}
                        : { wholesaleMinQty: input.wholesaleMinQty }),
                      ...(input.currency === undefined ? {} : { currency: input.currency }),
                    }
                  : item,
              ),
            };
          }

          const item: CartItem = {
            cartLineId: lineId,
            productId: input.productId,
            name: input.name,
            supplierId: input.supplierId,
            supplierName: input.supplierName,
            supplierUserId: input.supplierUserId,
            purchaseMode: input.purchaseMode,
            quantity,
            unitPrice,
            retailUnitPrice,
            ...(wholesaleUnitPrice === undefined ? {} : { wholesaleUnitPrice }),
            ...(input.brand === undefined ? {} : { brand: input.brand }),
            ...(input.image === undefined ? {} : { image: input.image }),
            ...(input.wholesaleMinQty === undefined
              ? {}
              : { wholesaleMinQty: input.wholesaleMinQty }),
            ...(input.currency === undefined ? {} : { currency: input.currency }),
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
            items: state.items.map((item) => {
              if (item.cartLineId !== lineId) return item;

              // Crossing the threshold re-prices from the API's own strings.
              const wholesalePrice = item.wholesaleUnitPrice;
              const wholesale =
                wholesalePrice !== undefined &&
                item.wholesaleMinQty !== undefined &&
                quantity >= item.wholesaleMinQty;
              const mode: PurchaseMode = wholesale ? "wholesale" : "retail";
              const unitPrice = wholesale && wholesalePrice ? wholesalePrice : item.retailUnitPrice;

              return { ...item, quantity, purchaseMode: mode, unitPrice };
            }),
          };
        }),

      removeLines: (lineIds) =>
        set((state) => ({
          items: state.items.filter((item) => !lineIds.includes(item.cartLineId)),
        })),

      clearCart: () => set({ items: [] }),
    }),
    {
      // v2: the pre-shop cart stored `{ id, name, price, qty }` under
      // `denthub-cart`. The new key deliberately orphans that payload rather
      // than migrating it, because the shapes are not compatible.
      name: "denthub-cart-v2",
      // v1 stored `unitPrice` as a number; v2 keeps it as the exact decimal
      // string the API returned. v3 adds the supplier fields checkout needs.
      // v4 keys a line by product alone and merges the old retail/wholesale pair.
      version: 4,
      partialize: (state) => ({ items: state.items }),
      migrate: (persisted, _version) => {
        const previous = (persisted ?? {}) as {
          items?: Array<
            Omit<
              CartItem,
              "unitPrice" | "retailUnitPrice" | "supplierId" | "supplierName" | "supplierUserId"
            > & {
              unitPrice: string | number;
              retailUnitPrice?: string;
              wholesaleUnitPrice?: string;
              supplierId?: string;
              supplierName?: string;
              supplierUserId?: string;
            }
          >;
        };

        const byProduct = new Map<string, CartItem>();
        for (const item of previous.items ?? []) {
          const previousLine = byProduct.get(item.productId);
          // Keep whichever mode the visitor chose last, preferring wholesale
          // when both modes were persisted for the same product.
          if (
            previousLine &&
            !(previousLine.purchaseMode !== "wholesale" && item.purchaseMode === "wholesale")
          ) {
            continue;
          }

          const unitPrice =
            typeof item.unitPrice === "number" ? item.unitPrice.toFixed(2) : item.unitPrice;
          byProduct.set(item.productId, {
            ...item,
            cartLineId: item.productId,
            unitPrice,
            retailUnitPrice: item.retailUnitPrice ?? unitPrice,
            ...(item.wholesaleUnitPrice === undefined
              ? {}
              : { wholesaleUnitPrice: item.wholesaleUnitPrice }),
            supplierId: item.supplierId ?? "",
            supplierName: item.supplierName ?? "",
            supplierUserId: item.supplierUserId ?? "",
          });
        }

        return { items: [...byProduct.values()] } satisfies PersistedCart;
      },
    },
  ),
);
