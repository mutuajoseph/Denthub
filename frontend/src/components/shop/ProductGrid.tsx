import { SearchX } from "lucide-react";

import type { Product } from "../../lib/productApi";
import ProductCard from "./ProductCard";

interface ProductGridProps {
  products: Product[];
  isLoading?: boolean;
  isFetching?: boolean;
  emptyMessage?: string;
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-navy-600 dark:bg-navy-800">
      <div className="h-40 animate-pulse bg-slate-200 dark:bg-navy-700" />
      <div className="space-y-2 p-4">
        <div className="h-3 w-16 animate-pulse rounded bg-slate-200 dark:bg-navy-700" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-navy-700" />
        <div className="h-6 w-20 animate-pulse rounded bg-slate-200 dark:bg-navy-700" />
      </div>
    </div>
  );
}

/** Responsive product grid with loading and empty states. */
export default function ProductGrid({
  products,
  isLoading = false,
  isFetching = false,
  emptyMessage = "No products match your filters.",
}: ProductGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div
        className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 py-16 text-center dark:border-navy-600"
        aria-live="polite"
      >
        <SearchX className="h-8 w-8 text-slate-400" aria-hidden="true" />
        <p className="text-sm text-slate-600 dark:text-gray-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4"
      aria-busy={isFetching}
    >
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
