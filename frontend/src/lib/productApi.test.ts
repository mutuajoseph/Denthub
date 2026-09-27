import { describe, expect, it, vi } from "vitest";

vi.mock("./apiClient", () => ({
  getJson: vi.fn(),
}));

import { getJson } from "./apiClient";
import {
  fetchProductCategories,
  fetchProducts,
  hasWholesale,
  mapProduct,
  mapProductPage,
  toMoney,
  unitPriceForMode,
} from "./productApi";

/** Raw wire payload exactly as FastAPI emits it — money is a JSON *string*. */
const wireProduct = {
  id: "d9107f47",
  name: "Adult Medium Toothbrush",
  brand: "Oral-B",
  category: "brushing",
  description: null,
  image_url: null,
  country_code: "KE",
  dentist_recommended: true,
  in_stock: true,
  supplier: {
    id: "66a8af20",
    name: "Nairobi Dental Supplies",
    slug: "nairobi-dental-supplies",
    scope: "local",
    is_verified: true,
  },
  pricing: {
    currency: "KES",
    quantity: 24,
    purchase_mode: "wholesale",
    unit_price: "260.00",
    line_total: "6240.00",
    retail_price: "350.00",
    wholesale_price: "260.00",
    wholesale_min_qty: 12,
  },
  created_at: "2026-09-27T07:21:09",
};

const getJsonMock = vi.mocked(getJson);

describe("toMoney", () => {
  it("parses the string amounts Pydantic emits for Decimal", () => {
    expect(toMoney("260.00")).toBe(260);
    expect(toMoney("337.50")).toBe(337.5);
  });

  it("passes numbers through", () => {
    expect(toMoney(12.34)).toBe(12.34);
  });

  it("returns null for absent or unparseable values rather than NaN", () => {
    expect(toMoney(null)).toBeNull();
    expect(toMoney(undefined)).toBeNull();
    expect(toMoney("not-a-number")).toBeNull();
  });
});

describe("mapProduct", () => {
  it("converts snake_case wire fields and parses money into numbers", () => {
    const product = mapProduct(wireProduct);

    expect(product.name).toBe("Adult Medium Toothbrush");
    expect(product.countryCode).toBe("KE");
    expect(product.dentistRecommended).toBe(true);
    expect(product.imageUrl).toBeNull();
    expect(product.supplier.name).toBe("Nairobi Dental Supplies");
    expect(product.pricing.unitPrice).toBe(260);
    expect(product.pricing.lineTotal).toBe(6240);
    expect(product.pricing.retailPrice).toBe(350);
    expect(product.pricing.purchaseMode).toBe("wholesale");
    expect(product.pricing.wholesaleMinQty).toBe(12);
  });

  it("preserves derived fractional cents exactly", () => {
    const product = mapProduct({
      ...wireProduct,
      pricing: { ...wireProduct.pricing, unit_price: "337.50", wholesale_price: "337.50" },
    });

    expect(product.pricing.unitPrice).toBe(337.5);
  });

  it("keeps a retail-only product's wholesale price null", () => {
    const product = mapProduct({
      ...wireProduct,
      pricing: {
        ...wireProduct.pricing,
        purchase_mode: "retail",
        unit_price: "500.00",
        wholesale_price: null,
        wholesale_min_qty: 0,
      },
    });

    expect(product.pricing.wholesalePrice).toBeNull();
    expect(product.pricing.wholesaleMinQty).toBe(0);
    expect(hasWholesale(product)).toBe(false);
  });

  it("does not crash on missing optional fields", () => {
    const product = mapProduct({
      ...wireProduct,
      brand: null,
      supplier: undefined as never,
      pricing: undefined as never,
    });

    expect(product.brand).toBeNull();
    expect(product.supplier.name).toBe("");
    expect(product.pricing.unitPrice).toBe(0);
  });
});

describe("mapProductPage", () => {
  it("maps the list envelope and items", () => {
    const page = mapProductPage({
      items: [wireProduct],
      total: 13,
      limit: 48,
      offset: 0,
      country_code: "KE",
      currency: "KES",
    });

    expect(page.total).toBe(13);
    expect(page.currency).toBe("KES");
    expect(page.items).toHaveLength(1);
    expect(page.items[0].pricing.currency).toBe("KES");
  });
});

describe("unitPriceForMode", () => {
  const product = mapProduct(wireProduct);

  it("selects the retail price already returned by the server", () => {
    expect(unitPriceForMode(product, "retail")).toBe(350);
  });

  it("selects the wholesale price already returned by the server", () => {
    expect(unitPriceForMode(product, "wholesale")).toBe(260);
  });

  it("falls back to retail when asking for wholesale on a retail-only product", () => {
    const retailOnly = mapProduct({
      ...wireProduct,
      pricing: { ...wireProduct.pricing, wholesale_price: null, wholesale_min_qty: 0 },
    });

    expect(unitPriceForMode(retailOnly, "wholesale")).toBe(350);
  });
});

describe("fetchProducts", () => {
  it("sends the query the backend expects and omits the All category sentinel", async () => {
    getJsonMock.mockResolvedValue({
      items: [],
      total: 0,
      limit: 48,
      offset: 0,
      country_code: "KE",
      currency: "KES",
    });

    await fetchProducts({ q: "toothbrush", quantity: 1, limit: 48, inStock: true });
    expect(getJsonMock).toHaveBeenCalledWith("/products", {
      query: {
        q: "toothbrush",
        category: undefined,
        quantity: 1,
        limit: 48,
        offset: undefined,
        dentist_recommended: undefined,
        in_stock: true,
      },
      signal: undefined,
    });
  });

  it("forwards the abort signal so superseded searches are cancelled", async () => {
    getJsonMock.mockResolvedValue({
      items: [],
      total: 0,
      limit: 48,
      offset: 0,
      country_code: "KE",
      currency: "KES",
    });

    const controller = new AbortController();
    await fetchProducts({}, controller.signal);

    expect(getJsonMock).toHaveBeenCalledWith(
      "/products",
      expect.objectContaining({
        signal: controller.signal,
      }),
    );
  });
});

describe("fetchProductCategories", () => {
  it("maps the category list envelope", async () => {
    getJsonMock.mockResolvedValue({ country_code: "KE", categories: ["brushing", "floss"] });

    await expect(fetchProductCategories()).resolves.toEqual({
      countryCode: "KE",
      categories: ["brushing", "floss"],
    });
  });
});
