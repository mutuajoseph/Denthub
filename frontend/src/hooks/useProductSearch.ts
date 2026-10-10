import { useQuery } from "@tanstack/react-query";

import { ALL_CATEGORIES, buildCategoryOptions } from "../config/productConstants";
import {
  type ProductCategories,
  type ProductPage,
  fetchProductCategories,
  fetchProducts,
} from "../lib/productApi";
import { useActiveCountryCode } from "./useActiveCountryCode";
import { useDebouncedValue } from "./useDebouncedValue";

const SEARCH_DEBOUNCE_MS = 300;

/** Page size. The backend caps `limit` at 100. */
export const PRODUCT_PAGE_SIZE = 48;

export interface UseProductSearchParams {
  /** Raw input from the search box; debounced before it hits the network. */
  search?: string;
  category?: string;
  /** Price every result for this quantity. */
  quantity?: number;
  inStock?: boolean;
}

/**
 * Catalog search, debounced.
 *
 * The query key lists every input the request reads — country, search, category,
 * quantity, stock filter — so a region switch refetches rather than serving
 * another market's prices. `placeholderData` keeps the previous page visible
 * while a new one loads so switching filters does not flash an empty grid.
 */
export function useProductSearch({
  search = "",
  category = ALL_CATEGORIES,
  quantity = 1,
  inStock = true,
}: UseProductSearchParams = {}) {
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const country = useActiveCountryCode();

  const page = useQuery<ProductPage>({
    queryKey: ["products", "search", country, debouncedSearch, category, quantity, inStock],
    queryFn: ({ signal }) =>
      fetchProducts(
        {
          q: debouncedSearch || undefined,
          category: category === ALL_CATEGORIES ? undefined : category,
          quantity,
          inStock,
          limit: PRODUCT_PAGE_SIZE,
        },
        signal,
      ),
    placeholderData: (previous) => previous,
  });

  return {
    products: page.data?.items ?? [],
    total: page.data?.total ?? 0,
    currency: page.data?.currency ?? "",
    isLoading: page.isPending,
    isFetching: page.isFetching,
    error: page.error,
    isSearchSettled: debouncedSearch === search.trim(),
  };
}

/** Categories actually stocked in the active country. */
export function useProductCategories() {
  const country = useActiveCountryCode();

  const query = useQuery<ProductCategories>({
    queryKey: ["products", "categories", country],
    queryFn: ({ signal }) => fetchProductCategories(signal),
    staleTime: 5 * 60 * 1000,
  });

  return {
    categories: buildCategoryOptions(query.data?.categories ?? []),
    isLoading: query.isPending,
    error: query.error,
  };
}
