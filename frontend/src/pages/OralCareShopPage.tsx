import { AlertCircle } from "lucide-react";
import { useCallback, useState } from "react";

import CartDrawer from "../components/shop/CartDrawer";
import CategoryFilter from "../components/shop/CategoryFilter";
import ProductGrid from "../components/shop/ProductGrid";
import ShopHero from "../components/shop/ShopHero";
import SubscriptionBox from "../components/shop/SubscriptionBox";
import { ALL_CATEGORIES } from "../config/productConstants";
import { useProductCategories, useProductSearch } from "../hooks/useProductSearch";

/**
 * Oral Care Shop.
 *
 * Read-only catalog backed by `GET /api/v1/products` — the source app shipped a
 * static array here, but the target has a real catalog endpoint, so this page
 * uses it directly and renders explicit loading, error and empty states.
 */
export default function OralCareShopPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const [isCartOpen, setCartOpen] = useState(false);

  const openCart = useCallback(() => setCartOpen(true), []);
  const closeCart = useCallback(() => setCartOpen(false), []);

  // Grid is priced for a single unit; the drawer warns on wholesale minimums.
  const catalog = useProductSearch({ search, category, quantity: 1 });
  const categoryOptions = useProductCategories();

  const currency = catalog.currency;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
      <ShopHero
        search={search}
        onSearchChange={setSearch}
        onOpenCart={openCart}
        currency={currency}
      />

      <CategoryFilter
        categories={categoryOptions.categories}
        active={category}
        onChange={setCategory}
        isLoading={categoryOptions.isLoading}
      />

      {catalog.error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
        >
          <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">Could not load the catalog</p>
            <p className="mt-0.5">Check your connection and try again in a moment.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-baseline justify-between">
            <p className="text-sm text-slate-600 dark:text-gray-400" aria-live="polite">
              {catalog.isLoading
                ? "Loading products..."
                : `${catalog.total} ${catalog.total === 1 ? "product" : "products"}`}
            </p>
          </div>

          <ProductGrid
            products={catalog.products}
            isLoading={catalog.isLoading}
            isFetching={catalog.isFetching}
            emptyMessage={catalog.isSearchSettled ? "No products match your search." : undefined}
          />
        </>
      )}

      <SubscriptionBox currency={currency} />

      <CartDrawer open={isCartOpen} onClose={closeCart} currency={currency} />
    </div>
  );
}
