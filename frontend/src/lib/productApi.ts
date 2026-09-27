/**
 * Typed client for the oral-care catalog, mirroring the backend Pydantic models
 * in `backend/app/logic/v1/products.py`.
 *
 * Money crosses the wire as a **JSON string** — Pydantic serialises `Decimal`
 * that way — so every amount is converted to a number once, here, and nothing
 * downstream has to think about it. Prices are *resolved by the server*: the
 * client asks for a quantity and reads back the tier, unit price and total. It
 * never derives a discount.
 */

import { getJson } from "./apiClient";

export type PurchaseMode = "retail" | "wholesale";

/** A product as the UI consumes it: money already parsed. */
export interface ProductPricing {
  currency: string;
  quantity: number;
  purchaseMode: PurchaseMode;
  unitPrice: number;
  lineTotal: number;
  retailPrice: number;
  /** Effective wholesale unit price, or `null` when the product is retail-only. */
  wholesalePrice: number | null;
  wholesaleMinQty: number;
}

export interface ProductSupplier {
  id: string;
  name: string;
  slug: string;
  scope: string;
  isVerified: boolean;
}

export interface Product {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  description: string | null;
  imageUrl: string | null;
  countryCode: string;
  dentistRecommended: boolean;
  inStock: boolean;
  supplier: ProductSupplier;
  pricing: ProductPricing;
  createdAt: string;
}

export interface ProductPage {
  items: Product[];
  total: number;
  limit: number;
  offset: number;
  countryCode: string;
  currency: string;
}

export interface ProductCategories {
  countryCode: string;
  categories: string[];
}

export interface ProductQuery {
  /** Matched against product name and brand. */
  q?: string;
  category?: string;
  /** Quantity the server should price every result for. */
  quantity?: number;
  limit?: number;
  offset?: number;
  dentistRecommended?: boolean;
  inStock?: boolean;
}

/* ------------------------------------------------------------------ *
 * Wire types — mirror the JSON exactly, including string money.
 * ------------------------------------------------------------------ */

type WireRecord = Record<string, unknown>;

interface WirePricing extends WireRecord {
  currency: string;
  quantity: number;
  purchase_mode: string;
  unit_price: string;
  line_total: string;
  retail_price: string;
  wholesale_price: string | null;
  wholesale_min_qty: number;
}

interface WireSupplier extends WireRecord {
  id: string;
  name: string;
  slug: string;
  scope: string;
  is_verified: boolean;
}

interface WireProduct extends WireRecord {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  description: string | null;
  image_url: string | null;
  country_code: string;
  dentist_recommended: boolean;
  in_stock: boolean;
  supplier: WireSupplier;
  pricing: WirePricing;
  created_at: string;
}

interface WirePage extends WireRecord {
  items: WireProduct[];
  total: number;
  limit: number;
  offset: number;
  country_code: string;
  currency: string;
}

interface WireCategoryList extends WireRecord {
  country_code: string;
  categories: string[];
}

/* ------------------------------------------------------------------ *
 * Coercion helpers — the API contract is trusted, but a stray `null`
 * must not turn into NaN and render "KSh NaN" on a card.
 * ------------------------------------------------------------------ */

/** Parse API money. Returns `null` only when the value is absent. */
export function toMoney(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;

  const parsed = typeof value === "number" ? value : Number.parseFloat(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function toMoneyOrZero(value: string | number | null | undefined): number {
  return toMoney(value) ?? 0;
}

function toCount(value: unknown, fallback: number): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function toOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function toPurchaseMode(value: unknown): PurchaseMode {
  return value === "wholesale" ? "wholesale" : "retail";
}

function mapSupplier(wire: WireSupplier | undefined): ProductSupplier {
  return {
    id: wire?.id ?? "",
    name: wire?.name ?? "",
    slug: wire?.slug ?? "",
    scope: wire?.scope ?? "",
    isVerified: Boolean(wire?.is_verified),
  };
}

export function mapProduct(wire: WireProduct): Product {
  const pricing = wire.pricing ?? ({} as WirePricing);

  return {
    id: wire.id,
    name: wire.name,
    brand: toOptionalString(wire.brand),
    category: wire.category,
    description: toOptionalString(wire.description),
    imageUrl: toOptionalString(wire.image_url),
    countryCode: wire.country_code,
    dentistRecommended: Boolean(wire.dentist_recommended),
    inStock: Boolean(wire.in_stock),
    supplier: mapSupplier(wire.supplier),
    createdAt: wire.created_at,
    pricing: {
      currency: pricing.currency ?? "",
      quantity: toCount(pricing.quantity, 1),
      purchaseMode: toPurchaseMode(pricing.purchase_mode),
      unitPrice: toMoneyOrZero(pricing.unit_price),
      lineTotal: toMoneyOrZero(pricing.line_total),
      retailPrice: toMoneyOrZero(pricing.retail_price),
      wholesalePrice: toMoney(pricing.wholesale_price),
      wholesaleMinQty: toCount(pricing.wholesale_min_qty, 0),
    },
  };
}

export function mapProductPage(wire: WirePage): ProductPage {
  return {
    items: (wire.items ?? []).map(mapProduct),
    total: toCount(wire.total, 0),
    limit: toCount(wire.limit, 0),
    offset: toCount(wire.offset, 0),
    countryCode: wire.country_code,
    currency: wire.currency,
  };
}

/* ------------------------------------------------------------------ *
 * Calls
 * ------------------------------------------------------------------ */

export function fetchProducts(
  query: ProductQuery = {},
  signal?: AbortSignal,
): Promise<ProductPage> {
  return getJson<WirePage>("/products", {
    query: {
      q: query.q,
      category: query.category,
      quantity: query.quantity,
      limit: query.limit,
      offset: query.offset,
      dentist_recommended: query.dentistRecommended,
      in_stock: query.inStock,
    },
    signal,
  }).then(mapProductPage);
}

export function fetchProduct(id: string, quantity = 1, signal?: AbortSignal): Promise<Product> {
  return getJson<WireProduct>(`/products/${encodeURIComponent(id)}`, {
    query: { quantity },
    signal,
  }).then(mapProduct);
}

export function fetchProductCategories(signal?: AbortSignal): Promise<ProductCategories> {
  return getJson<WireCategoryList>("/products/categories", { signal }).then((wire) => ({
    countryCode: wire.country_code,
    categories: wire.categories ?? [],
  }));
}

/**
 * Whether a product can be bought at the wholesale tier.
 *
 * The server signals this by reporting an effective `wholesale_price`; a
 * product with none is retail-only, regardless of what the toggle would like
 * to offer.
 */
export function hasWholesale(product: Product): boolean {
  return product.pricing.wholesalePrice !== null;
}

/**
 * Pick the unit price for a mode from prices the server already sent.
 *
 * This selects between two authoritative figures — it performs no arithmetic
 * and applies no discount of its own.
 */
export function unitPriceForMode(product: Product, mode: PurchaseMode): number {
  if (mode === "wholesale") {
    return product.pricing.wholesalePrice ?? product.pricing.retailPrice;
  }

  return product.pricing.retailPrice;
}
