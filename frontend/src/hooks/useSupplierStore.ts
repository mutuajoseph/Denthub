import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  type CreateProductInput,
  type CreateStoreInput,
  type SupplierProductPage,
  type UpdateProductInput,
  createMyStore,
  createProduct,
  fetchMyProducts,
  fetchMyStore,
  updateProduct,
} from "../lib/supplierApi";

/** One page of a store's own products; matches the backend default page size. */
export const SUPPLIER_PRODUCT_LIMIT = 48;

/**
 * Every supplier-store query key starts here, so one `invalidateQueries` on
 * this prefix refreshes the store and its product list after any write.
 */
export const SUPPLIER_QUERY_KEY = ["supplier"] as const;

/**
 * The signed-in supplier's storefront.
 *
 * `store === null` is a real state — the account has not created one yet — and
 * renders the create-store form, not an error. The query's own status union is
 * surfaced as `isLoading` / `isError` for the page to branch on.
 */
export function useMyStore() {
  const query = useQuery({
    queryKey: [...SUPPLIER_QUERY_KEY, "store"],
    queryFn: ({ signal }) => fetchMyStore(signal),
    staleTime: 30_000,
  });

  return {
    store: query.data ?? null,
    isLoading: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/** One page of the caller's own products, out-of-stock ones included. */
export function useMyProducts(limit: number = SUPPLIER_PRODUCT_LIMIT, offset = 0) {
  const query = useQuery<SupplierProductPage>({
    queryKey: [...SUPPLIER_QUERY_KEY, "products", limit, offset],
    queryFn: ({ signal }) => fetchMyProducts(limit, offset, signal),
    staleTime: 30_000,
  });

  return {
    products: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useCreateStore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateStoreInput) => createMyStore(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SUPPLIER_QUERY_KEY }),
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProductInput) => createProduct(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SUPPLIER_QUERY_KEY }),
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: UpdateProductInput }) =>
      updateProduct(id, changes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SUPPLIER_QUERY_KEY }),
  });
}
