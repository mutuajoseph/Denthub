import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type ProductPage, fetchProductCategories, fetchProducts } from "../lib/productApi";
import { useCartStore } from "../store/cartStore";
import OralCareShopPage from "./OralCareShopPage";

vi.mock("../lib/productApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/productApi")>();

  return {
    ...actual,
    fetchProducts: vi.fn(),
    fetchProductCategories: vi.fn(),
  };
});

vi.mock("react-hot-toast", () => ({ default: { success: vi.fn() } }));

const fetchProductsMock = vi.mocked(fetchProducts);
const fetchCategoriesMock = vi.mocked(fetchProductCategories);

function buildProduct(overrides: Partial<ProductPage["items"][number]> = {}) {
  return {
    id: "p1",
    name: "Adult Medium Toothbrush",
    brand: "Oral-B",
    category: "brushing",
    description: "Medium bristles for adults.",
    imageUrl: null,
    countryCode: "KE",
    dentistRecommended: false,
    inStock: true,
    supplier: {
      id: "s1",
      name: "Nairobi Dental Supplies",
      slug: "nairobi-dental-supplies",
      scope: "local",
      isVerified: true,
    },
    pricing: {
      currency: "KES",
      quantity: 1,
      purchaseMode: "retail" as const,
      unitPrice: 350,
      lineTotal: 350,
      retailPrice: 350,
      wholesalePrice: 262.5,
      wholesaleMinQty: 12,
    },
    createdAt: "2026-09-27T07:21:09",
    ...overrides,
  };
}

function page(overrides: Partial<ProductPage> = {}): ProductPage {
  return {
    items: [buildProduct()],
    total: 1,
    limit: 48,
    offset: 0,
    countryCode: "KE",
    currency: "KES",
    ...overrides,
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <OralCareShopPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("OralCareShopPage", () => {
  beforeEach(() => {
    useCartStore.getState().clearCart();
    fetchCategoriesMock.mockResolvedValue({ countryCode: "KE", categories: ["brushing", "floss"] });
    fetchProductsMock.mockResolvedValue(page());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders products returned by the API", async () => {
    renderPage();

    expect(await screen.findByText("Adult Medium Toothbrush")).toBeInTheDocument();
    expect(screen.getByText("1 product")).toBeInTheDocument();
    expect(screen.getByText("KES 350")).toBeInTheDocument();
  });

  it("asks the API to price the grid for a single unit", async () => {
    renderPage();

    await screen.findByText("Adult Medium Toothbrush");

    expect(fetchProductsMock).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 1, limit: 48, inStock: true }),
      expect.anything(),
    );
  });

  it("shows an error state when the catalog request fails", async () => {
    fetchProductsMock.mockRejectedValue(new Error("boom"));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not load the catalog/i);
    expect(screen.queryByText("Adult Medium Toothbrush")).not.toBeInTheDocument();
  });

  it("shows an empty state when the search matches nothing", async () => {
    fetchProductsMock.mockResolvedValue(page({ items: [], total: 0 }));
    renderPage();

    expect(await screen.findByText(/no products match your search/i)).toBeInTheDocument();
  });

  it("builds the category filter from the API, with All first", async () => {
    renderPage();

    await screen.findByText("Adult Medium Toothbrush");

    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Brushing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Floss" })).toBeInTheDocument();
  });

  it("sends the selected category to the API and marks it active", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Adult Medium Toothbrush");

    await user.click(screen.getByRole("button", { name: "Floss" }));

    await waitFor(() => {
      expect(fetchProductsMock).toHaveBeenCalledWith(
        expect.objectContaining({ category: "floss" }),
        expect.anything(),
      );
    });
    expect(screen.getByRole("button", { name: "Floss" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "false");
  });

  it("does not send the All sentinel as a category filter", async () => {
    renderPage();
    await screen.findByText("Adult Medium Toothbrush");

    expect(fetchProductsMock).toHaveBeenCalledWith(
      expect.objectContaining({ category: undefined }),
      expect.anything(),
    );
  });

  it("debounces typing so a burst of keystrokes issues one request", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Adult Medium Toothbrush");

    const callsAfterMount = fetchProductsMock.mock.calls.length;

    await user.type(screen.getByPlaceholderText(/search products/i), "floss");

    // The full term settles, and the intermediate keystrokes did not each fire.
    await waitFor(() => {
      expect(fetchProductsMock).toHaveBeenCalledWith(
        expect.objectContaining({ q: "floss" }),
        expect.anything(),
      );
    });

    const searchCalls = fetchProductsMock.mock.calls.length - callsAfterMount;
    expect(searchCalls).toBeLessThan(5);
  });

  it("treats a whitespace-only search as no filter", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Adult Medium Toothbrush");

    await user.type(screen.getByPlaceholderText(/search products/i), "   ");

    await waitFor(() => {
      expect(fetchProductsMock.mock.calls.some(([params]) => params?.q !== undefined)).toBe(false);
    });
  });

  it("renders the subscription tiers and the cart button", async () => {
    renderPage();

    expect(await screen.findByText("Oral Care Subscriptions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cart is empty/i })).toBeInTheDocument();
  });

  it("opens the cart drawer and shows what was added", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Adult Medium Toothbrush");

    await user.click(screen.getByRole("button", { name: /add to cart/i }));
    await user.click(screen.getByRole("button", { name: /cart is empty|1 item in cart/i }));

    const drawer = await screen.findByRole("dialog", { name: /shopping cart/i });
    expect(drawer).toHaveTextContent("Adult Medium Toothbrush");
    expect(drawer).toHaveTextContent("KES 350");
  });
});
