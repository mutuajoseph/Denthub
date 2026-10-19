/**
 * Typed client for the supplier storefront dashboard, mirroring the backend
 * Pydantic models in `backend/app/logic/v1/suppliers.py`.
 *
 * Money crosses the wire as a **JSON string** (Pydantic serialises `Decimal`
 * that way), so this client keeps every amount as the exact string the server
 * sent — it never parses to a float. Formatting happens once, in the view,
 * through `formatListingPrice`, which decides cents on the string itself.
 */

import { ApiError, getJson, patchJson, postJson } from "./apiClient";

export type StoreScope = "local" | "international";

/** The signed-in supplier's own storefront. */
export interface SupplierStore {
  id: string;
  name: string;
  slug: string;
  scope: StoreScope;
  countryCode: string;
  description: string | null;
  isVerified: boolean;
  productCount: number;
  createdAt: string;
}

/** A product as its own seller sees it: raw stored prices, as strings. */
export interface SupplierProduct {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  description: string | null;
  imageUrl: string | null;
  countryCode: string;
  currency: string;
  /** Exact decimal string, e.g. `"350.00"`. */
  retailPrice: string;
  /** Exact decimal string, or `null` when the product has no wholesale tier. */
  wholesalePrice: string | null;
  wholesaleMinQty: number;
  inStock: boolean;
  dentistRecommended: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierProductPage {
  items: SupplierProduct[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateStoreInput {
  name: string;
  scope: StoreScope;
  description?: string | null;
}

export interface CreateProductInput {
  name: string;
  category: string;
  /** Decimal string; the backend validates and quantizes it. */
  retailPrice: string;
  brand?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  /** Decimal string, or `null` for a retail-only product. */
  wholesalePrice?: string | null;
  wholesaleMinQty?: number;
  inStock?: boolean;
  dentistRecommended?: boolean;
}

/** PATCH body: send only the fields that change. */
export type UpdateProductInput = Partial<CreateProductInput>;

/* ------------------------------------------------------------------ *
 * Wire types — mirror the JSON exactly, including string money.
 * ------------------------------------------------------------------ */

type WireRecord = Record<string, unknown>;

interface WireStore extends WireRecord {
  id: string;
  name: string;
  slug: string;
  scope: string;
  country_code: string;
  description: string | null;
  is_verified: boolean;
  product_count: number;
  created_at: string;
}

interface WireProduct extends WireRecord {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  description: string | null;
  image_url: string | null;
  country_code: string;
  currency: string;
  retail_price: string;
  wholesale_price: string | null;
  wholesale_min_qty: number;
  in_stock: boolean;
  dentist_recommended: boolean;
  created_at: string;
  updated_at: string;
}

interface WireProductPage extends WireRecord {
  items: WireProduct[];
  total: number;
  limit: number;
  offset: number;
}

/* ------------------------------------------------------------------ *
 * Coercion helpers — the contract is trusted, but a stray value must
 * not render as "NaN" on a store card.
 * ------------------------------------------------------------------ */

function toScope(value: unknown): StoreScope {
  return value === "international" ? "international" : "local";
}

function toOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Keep an API money value as its exact string; `null` passes through. */
function toMoneyString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);

  return null;
}

function toCount(value: unknown, fallback: number): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

export function mapStore(wire: WireStore): SupplierStore {
  return {
    id: wire.id,
    name: wire.name,
    slug: wire.slug,
    scope: toScope(wire.scope),
    countryCode: wire.country_code,
    description: toOptionalString(wire.description),
    isVerified: Boolean(wire.is_verified),
    productCount: toCount(wire.product_count, 0),
    createdAt: wire.created_at,
  };
}

export function mapSupplierProduct(wire: WireProduct): SupplierProduct {
  return {
    id: wire.id,
    name: wire.name,
    brand: toOptionalString(wire.brand),
    category: wire.category,
    description: toOptionalString(wire.description),
    imageUrl: toOptionalString(wire.image_url),
    countryCode: wire.country_code,
    currency: wire.currency,
    retailPrice: toMoneyString(wire.retail_price) ?? "0",
    wholesalePrice: toMoneyString(wire.wholesale_price),
    wholesaleMinQty: toCount(wire.wholesale_min_qty, 0),
    inStock: Boolean(wire.in_stock),
    dentistRecommended: Boolean(wire.dentist_recommended),
    createdAt: wire.created_at,
    updatedAt: wire.updated_at,
  };
}

function mapStorePage(wire: WireProductPage): SupplierProductPage {
  return {
    items: (wire.items ?? []).map(mapSupplierProduct),
    total: toCount(wire.total, 0),
    limit: toCount(wire.limit, 0),
    offset: toCount(wire.offset, 0),
  };
}

/* ------------------------------------------------------------------ *
 * Calls
 * ------------------------------------------------------------------ */

/**
 * The caller's storefront, or `null` when they have not created one yet.
 *
 * The backend answers 404 for "no store", which the dashboard renders as the
 * create-store form — so that one status is a data state, not an error.
 */
export function fetchMyStore(signal?: AbortSignal): Promise<SupplierStore | null> {
  return getJson<WireStore>("/suppliers/me", { auth: true, signal })
    .then(mapStore)
    .catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    });
}

export function createMyStore(
  input: CreateStoreInput,
  signal?: AbortSignal,
): Promise<SupplierStore> {
  return postJson<WireStore>(
    "/suppliers/me",
    {
      name: input.name,
      scope: input.scope,
      description: input.description ?? null,
    },
    { auth: true, signal },
  ).then(mapStore);
}

export function fetchMyProducts(
  limit: number,
  offset = 0,
  signal?: AbortSignal,
): Promise<SupplierProductPage> {
  return getJson<WireProductPage>("/suppliers/me/products", {
    query: { limit, offset },
    auth: true,
    signal,
  }).then(mapStorePage);
}

function toProductBody(input: CreateProductInput | UpdateProductInput): WireRecord {
  const body: WireRecord = {};

  if (input.name !== undefined) body.name = input.name;
  if (input.category !== undefined) body.category = input.category;
  if (input.retailPrice !== undefined) body.retail_price = input.retailPrice;
  if (input.brand !== undefined) body.brand = input.brand;
  if (input.description !== undefined) body.description = input.description;
  if (input.imageUrl !== undefined) body.image_url = input.imageUrl;
  if (input.wholesalePrice !== undefined) body.wholesale_price = input.wholesalePrice;
  if (input.wholesaleMinQty !== undefined) body.wholesale_min_qty = input.wholesaleMinQty;
  if (input.inStock !== undefined) body.in_stock = input.inStock;
  if (input.dentistRecommended !== undefined) body.dentist_recommended = input.dentistRecommended;

  return body;
}

export function createProduct(
  input: CreateProductInput,
  signal?: AbortSignal,
): Promise<SupplierProduct> {
  return postJson<WireProduct>("/suppliers/me/products", toProductBody(input), {
    auth: true,
    signal,
  }).then(mapSupplierProduct);
}

export function updateProduct(
  productId: string,
  changes: UpdateProductInput,
  signal?: AbortSignal,
): Promise<SupplierProduct> {
  return patchJson<WireProduct>(
    `/suppliers/me/products/${encodeURIComponent(productId)}`,
    toProductBody(changes),
    { auth: true, signal },
  ).then(mapSupplierProduct);
}
