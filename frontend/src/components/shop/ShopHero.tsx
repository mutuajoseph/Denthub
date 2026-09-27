import { ShoppingCart } from "lucide-react";

import { FREE_DELIVERY_THRESHOLD } from "../../config/productConstants";
import { useCartStore } from "../../store/cartStore";
import { selectCartCount } from "../../store/cartStore";
import { formatPrice } from "../../utils/formatCurrency";
import SearchBar from "../ui/SearchBar";

/**
 * Chip on the light card surface.
 *
 * `ui/Badge` variants all assume a dark background (`text-gold-300` on a
 * translucent tint), so they disappear here in light mode.
 */
function HeroChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 font-mono text-xs font-medium text-orange-600 dark:border-gold-400/30 dark:bg-gold-400/10 dark:text-gold-300">
      {children}
    </span>
  );
}

interface ShopHeroProps {
  search: string;
  onSearchChange: (value: string) => void;
  onOpenCart: () => void;
  /** Currency the catalog is priced in, from the API. */
  currency: string;
}

/** Shop masthead: badges, headline, search, and a cart entry point. */
export default function ShopHero({ search, onSearchChange, onOpenCart, currency }: ShopHeroProps) {
  const count = selectCartCount(useCartStore((state) => state.items));

  return (
    <section className="relative mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 md:p-12 dark:border-navy-600 dark:bg-gradient-to-br dark:from-navy-950 dark:via-navy-800 dark:to-navy-900">
      <div
        className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-orange-400/10 blur-3xl dark:bg-gold-400/5"
        aria-hidden="true"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <HeroChip>Free delivery above {formatPrice(FREE_DELIVERY_THRESHOLD, currency)}</HeroChip>
        <HeroChip>Wholesale on eligible products</HeroChip>
      </div>

      <h1 className="gold-gradient-text mb-2 font-display text-3xl font-bold md:text-4xl">
        Dentist-Recommended Oral Care
      </h1>

      <p className="mb-6 max-w-xl text-slate-600 dark:text-gray-400">
        Shop retail for home use, or switch any eligible product to{" "}
        <strong className="font-medium text-orange-500 dark:text-gold-300/90">wholesale</strong> for
        clinic bulk orders. Prices come from our catalog, so what you see is what you pay.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar
          value={search}
          onChange={onSearchChange}
          placeholder="Search products, brands..."
          className="max-w-md flex-1"
        />

        <button
          type="button"
          onClick={onOpenCart}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-navy-600 px-4 py-3 text-sm font-medium text-gray-300 transition-colors hover:border-gold-400/50 hover:text-gold-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400"
        >
          <ShoppingCart className="h-5 w-5" aria-hidden="true" />
          Cart
          {count > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
              {count}
            </span>
          )}
          <span className="sr-only">
            {count === 0 ? "cart is empty" : `${count} item${count === 1 ? "" : "s"} in cart`}
          </span>
        </button>
      </div>
    </section>
  );
}
