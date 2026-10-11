import { ShoppingCart } from "lucide-react";

import { FREE_DELIVERY_THRESHOLD } from "../../config/productConstants";
import { selectCartCount, useCartStore } from "../../store/cartStore";
import { formatPrice } from "../../utils/formatCurrency";
import SearchBar from "../ui/SearchBar";

interface ShopHeroProps {
  search: string;
  onSearchChange: (value: string) => void;
  onOpenCart: () => void;
  /** Currency the catalog is priced in, from the API. */
  currency: string;
}

/** Shop masthead: headline, search, and a cart entry point. */
export default function ShopHero({ search, onSearchChange, onOpenCart, currency }: ShopHeroProps) {
  const count = selectCartCount(useCartStore((state) => state.items));

  return (
    <section className="mb-8 rounded-card border border-steel bg-paper p-8 md:p-12">
      <h1 className="mb-3 font-display text-4xl font-medium tracking-[-0.04em] text-ink md:text-display-section">
        Dentist-Recommended Oral Care
      </h1>

      <p className="mb-6 max-w-xl text-slate">
        Shop retail for home use, or switch any eligible product to{" "}
        <strong className="font-medium text-ink">wholesale</strong> for clinic bulk orders. Prices
        come from our catalog, so what you see is what you pay.
      </p>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar
          value={search}
          onChange={onSearchChange}
          placeholder="Search products, brands..."
          className="max-w-md flex-1"
        />

        <button
          type="button"
          onClick={onOpenCart}
          className="inline-flex items-center justify-center gap-2 rounded-button border border-steel bg-paper px-4 py-3 text-sm font-medium text-charcoal transition-colors hover:bg-cloud focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <ShoppingCart className="h-5 w-5" aria-hidden="true" />
          Cart
          {count > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-bold text-paper">
              {count}
            </span>
          )}
          <span className="sr-only">
            {count === 0 ? "cart is empty" : `${count} item${count === 1 ? "" : "s"} in cart`}
          </span>
        </button>
      </div>

      {/* Capability row (DESIGN.md): compact items paired with a dark square tile. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-charcoal">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-[2px] bg-ink" aria-hidden="true" />
          Free delivery above {formatPrice(FREE_DELIVERY_THRESHOLD, currency)}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-[2px] bg-ink" aria-hidden="true" />
          Wholesale on eligible products
        </span>
      </div>
    </section>
  );
}
