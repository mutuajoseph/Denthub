import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useRegion } from "../hooks/useRegion";
import { selectCartCount, selectCartSubtotal, useCartStore } from "../store/cartStore";

function formatPrice(value: number) {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString();
}

export default function CartDropdown() {
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const count = selectCartCount(items);
  const subtotal = selectCartSubtotal(items);
  const { currencySymbol } = useRegion();

  return (
    <div
      role="menu"
      aria-label="Shopping cart"
      className="
        absolute
        right-0
        top-full
        z-[99999]
        mt-2
        w-[340px]
        max-w-[calc(100vw-2rem)]
        overflow-hidden
        rounded-xl
        border
        border-slate-200
        bg-white
        shadow-2xl
        dark:border-navy-600
        dark:bg-navy-800
      "
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-navy-600">
        <p className="text-sm font-semibold text-[#172b4d] dark:text-white">Your Cart ({count})</p>
        {count > 0 && (
          <button
            type="button"
            onClick={clearCart}
            className="text-xs font-medium text-slate-400 transition hover:text-red-500"
          >
            Clear
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
          <ShoppingBag className="h-10 w-10 text-slate-300 dark:text-navy-600" aria-hidden="true" />
          <p className="text-sm text-slate-400 dark:text-gray-400">Your cart is empty.</p>
          <Link
            to="/shop"
            className="mt-1 text-sm font-semibold text-orange-500 transition hover:text-orange-600 dark:text-gold-400"
          >
            Browse the shop →
          </Link>
        </div>
      ) : (
        <>
          <ul className="max-h-[300px] divide-y divide-slate-100 overflow-y-auto dark:divide-navy-600">
            {items.map((item) => (
              <li key={item.cartLineId} className="flex items-center gap-3 px-4 py-3">
                {item.image ? (
                  <img
                    src={item.image}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-500 dark:bg-navy-700 dark:text-gold-400">
                    <ShoppingBag className="h-5 w-5" aria-hidden="true" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#172b4d] dark:text-white">
                    {item.name}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-gray-400">
                    {currencySymbol}
                    {formatPrice(item.unitPrice * item.quantity)}
                  </p>
                  {item.purchaseMode === "wholesale" && (
                    <span className="mt-0.5 inline-block rounded bg-gold-400/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-600 dark:text-gold-300">
                      Wholesale
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.cartLineId, item.quantity - 1)}
                    aria-label={`Decrease quantity of ${item.name}`}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:border-orange-500 hover:text-orange-500 dark:border-navy-600 dark:text-gray-300"
                  >
                    <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold text-[#172b4d] dark:text-white">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.cartLineId, item.quantity + 1)}
                    aria-label={`Increase quantity of ${item.name}`}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:border-orange-500 hover:text-orange-500 dark:border-navy-600 dark:text-gray-300"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => removeItem(item.cartLineId)}
                  aria-label={`Remove ${item.name}`}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>

          <div className="border-t border-slate-100 px-4 py-3 dark:border-navy-600">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 dark:text-gray-400">Subtotal</span>
              <span className="font-semibold text-[#172b4d] dark:text-white">
                {currencySymbol}
                {formatPrice(subtotal)}
              </span>
            </div>
            <Link
              to="/shop"
              className="mt-3 block w-full rounded-lg bg-orange-500 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-orange-600"
            >
              Checkout
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
