import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { useRegion } from "../../hooks/useRegion";
import {
  type CartItem,
  selectCartCurrency,
  selectCartSubtotal,
  selectHasWholesaleLine,
  useCartStore,
} from "../../store/cartStore";
import { useCartUiStore } from "../../store/cartUiStore";
import { cn } from "../../utils/cn";
import { formatPrice } from "../../utils/formatCurrency";
import { ProductThumbnail } from "./ProductImage";

/** Money is summed in the browser here, so round off the float dust. */
function toCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function CartLine({
  item,
  currency,
}: {
  item: CartItem;
  currency: string;
}) {
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);

  const minQty = item.purchaseMode === "wholesale" ? (item.wholesaleMinQty ?? 1) : 1;
  const belowMinimum = item.quantity < minQty;

  return (
    <li className="flex gap-3 py-3">
      <ProductThumbnail src={item.image ?? null} alt={item.name} category="specialty" />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {item.brand && (
              <p className="font-mono text-[10px] text-slate-500 dark:text-gray-400">
                {item.brand}
              </p>
            )}
            <p className="truncate text-sm font-medium text-[#172b4d] dark:text-white">
              {item.name}
            </p>
            <p
              className={cn(
                "text-[11px] font-medium",
                item.purchaseMode === "wholesale"
                  ? "text-orange-500 dark:text-gold-300"
                  : "text-slate-500 dark:text-gray-400",
              )}
            >
              {item.purchaseMode === "wholesale" ? "Wholesale" : "Retail"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => removeItem(item.cartLineId)}
            aria-label={`Remove ${item.name} from cart`}
            className="shrink-0 rounded p-1 text-slate-400 transition-colors hover:text-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-navy-600">
            <button
              type="button"
              onClick={() => updateQuantity(item.cartLineId, item.quantity - 1)}
              aria-label={`Decrease ${item.name} quantity`}
              className="p-1.5 text-slate-600 transition-colors hover:text-orange-500 dark:text-gray-300"
            >
              <Minus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>

            <span
              className="min-w-8 text-center text-sm font-medium"
              aria-live="polite"
              aria-label={`Quantity ${item.quantity}`}
            >
              {item.quantity}
            </span>

            <button
              type="button"
              onClick={() => updateQuantity(item.cartLineId, item.quantity + 1)}
              aria-label={`Increase ${item.name} quantity`}
              className="p-1.5 text-slate-600 transition-colors hover:text-orange-500 dark:text-gray-300"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <p className="text-sm font-semibold text-[#172b4d] dark:text-white">
            {formatPrice(toCents(item.unitPrice * item.quantity), currency)}
          </p>
        </div>

        {belowMinimum && (
          <output
            className="mt-1 block text-[11px] text-orange-500 dark:text-gold-300"
            aria-live="polite"
          >
            Wholesale starts at {minQty} units — add {minQty - item.quantity} more.
          </output>
        )}
      </div>
    </li>
  );
}

/**
 * Slide-over cart.
 *
 * The single global cart surface, rendered once by `AppShell`. It reads
 * visibility from `useCartUiStore` so the navbar button and the shop page can
 * both open it. Wholesale minimums are surfaced as an advisory note; the API
 * re-prices and can reject the order, so the client does not enforce them.
 */
export default function CartDrawer() {
  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const subtotal = selectCartSubtotal(items);
  const hasWholesale = selectHasWholesaleLine(items);

  const isDrawerOpen = useCartUiStore((state) => state.isDrawerOpen);
  const closeCartDrawer = useCartUiStore((state) => state.closeCartDrawer);

  // The API prices each line in its own currency; fall back to the active
  // region for lines persisted before `currency` was recorded.
  const regionCurrency = useRegion().currency;
  const currency = selectCartCurrency(items, regionCurrency);

  const panelRef = useRef<HTMLDialogElement>(null);

  // Escape to close, and lock background scroll while the drawer is open.
  useEffect(() => {
    if (!isDrawerOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCartDrawer();
    };

    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isDrawerOpen, closeCartDrawer]);

  return (
    <>
      {isDrawerOpen && (
        // Decorative click-catcher. A labelled button here would duplicate the
        // header close button's accessible name; `ui/Modal` uses the same
        // aria-hidden div. Escape is handled by the document listener above.
        <div
          aria-hidden="true"
          onClick={closeCartDrawer}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") closeCartDrawer();
          }}
          // Above the sticky header (z-50) so the nav is inert while open.
          className="fixed inset-0 z-[90] cursor-default bg-navy-950/60 backdrop-blur-sm"
        />
      )}

      <dialog
        open={isDrawerOpen}
        aria-label="Shopping cart"
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          // z-[100] clears the sticky header (z-50) and the drawer's own
          // backdrop (z-[90]).
          "fixed right-0 top-0 z-[100] m-0 flex h-full max-h-none w-full max-w-md flex-col border-l border-slate-200 bg-white p-0 text-[#172b4d] shadow-xl transition-transform duration-300 outline-none dark:border-navy-600 dark:bg-navy-900 dark:text-white",
          isDrawerOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-navy-600">
          <h2 className="font-display text-lg font-bold text-[#172b4d] dark:text-white">
            Your Cart
            {items.length > 0 && (
              <span className="ml-2 text-sm font-normal text-slate-500 dark:text-gray-400">
                ({items.length} {items.length === 1 ? "line" : "lines"})
              </span>
            )}
          </h2>

          <button
            type="button"
            onClick={closeCartDrawer}
            aria-label="Close cart"
            className="rounded p-1.5 text-slate-500 transition-colors hover:text-[#172b4d] dark:text-gray-400 dark:hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <ShoppingBag
              className="h-10 w-10 text-slate-300 dark:text-navy-600"
              aria-hidden="true"
            />
            <p className="text-sm text-slate-600 dark:text-gray-400">
              Your cart is empty. Add some oral care essentials.
            </p>
            <button
              type="button"
              onClick={closeCartDrawer}
              className="mt-2 rounded-lg border border-navy-600 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-gold-400/50 hover:text-gold-400"
            >
              Continue shopping
            </button>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-slate-200 overflow-y-auto px-4 dark:divide-navy-600">
              {items.map((item) => (
                <CartLine key={item.cartLineId} item={item} currency={currency} />
              ))}
            </ul>

            <div className="space-y-3 border-t border-slate-200 p-4 dark:border-navy-600">
              {hasWholesale && (
                <output
                  className="block text-[11px] text-orange-500 dark:text-gold-300"
                  aria-live="polite"
                >
                  Wholesale lines need a clinic account. Final pricing is confirmed at checkout.
                </output>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-gray-400">Subtotal</span>
                <span className="text-lg font-bold text-[#172b4d] dark:text-white">
                  {formatPrice(toCents(subtotal), currency)}
                </span>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-gray-400">
                Taxes and delivery are calculated at checkout.
              </p>

              <button
                type="button"
                className="w-full rounded-lg bg-orange-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400"
              >
                Checkout
              </button>

              <button
                type="button"
                onClick={clearCart}
                className="w-full text-center text-[11px] text-slate-500 underline transition-colors hover:text-red-500 dark:text-gray-400"
              >
                Clear cart
              </button>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
