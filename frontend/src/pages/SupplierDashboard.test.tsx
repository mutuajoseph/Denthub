import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type SupplierProduct,
  type SupplierProductPage,
  type SupplierStore,
  createMyStore,
  createProduct,
  fetchMyProducts,
  fetchMyStore,
  updateProduct,
} from "../lib/supplierApi";
import { SupplierDashboard } from "./SupplierDashboard";

vi.mock("../lib/supplierApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/supplierApi")>();

  return {
    ...actual,
    fetchMyStore: vi.fn(),
    createMyStore: vi.fn(),
    fetchMyProducts: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
  };
});

const fetchMyStoreMock = vi.mocked(fetchMyStore);
const createMyStoreMock = vi.mocked(createMyStore);
const fetchMyProductsMock = vi.mocked(fetchMyProducts);
const createProductMock = vi.mocked(createProduct);
const updateProductMock = vi.mocked(updateProduct);

const STORE: SupplierStore = {
  id: "store-1",
  name: "Acme Dental Supplies",
  slug: "acme-dental-supplies",
  scope: "local",
  countryCode: "KE",
  description: null,
  isVerified: false,
  productCount: 1,
  createdAt: "2026-01-01T00:00:00Z",
};

const PRODUCT: SupplierProduct = {
  id: "product-1",
  name: "Composite Resin 4g",
  brand: null,
  category: "Restorative",
  description: null,
  imageUrl: null,
  countryCode: "KE",
  currency: "KES",
  retailPrice: "350.00",
  wholesalePrice: "260.00",
  wholesaleMinQty: 6,
  inStock: true,
  dentistRecommended: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function page(items: SupplierProduct[]): SupplierProductPage {
  return { items, total: items.length, limit: 48, offset: 0 };
}

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <SupplierDashboard />
    </QueryClientProvider>,
  );
}

describe("SupplierDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMyStoreMock.mockResolvedValue(null);
    fetchMyProductsMock.mockResolvedValue(page([]));
  });

  it("offers the create-store form when the account has no store", async () => {
    renderDashboard();

    expect(await screen.findByRole("heading", { name: /set up your store/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create store/i })).toBeInTheDocument();
  });

  it("creates a store and then shows it", async () => {
    const user = userEvent.setup();
    fetchMyStoreMock.mockResolvedValueOnce(null).mockResolvedValue(STORE);
    createMyStoreMock.mockResolvedValue(STORE);

    renderDashboard();

    await user.type(await screen.findByLabelText(/store name/i), "Acme Dental Supplies");
    await user.click(screen.getByRole("button", { name: /create store/i }));

    await waitFor(() =>
      expect(createMyStoreMock).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Acme Dental Supplies", scope: "local" }),
      ),
    );

    expect(
      await screen.findByRole("heading", { name: /acme dental supplies/i }),
    ).toBeInTheDocument();
  });

  it("lists the store's products with exact prices", async () => {
    fetchMyStoreMock.mockResolvedValue(STORE);
    fetchMyProductsMock.mockResolvedValue(page([PRODUCT]));

    renderDashboard();

    expect(
      await screen.findByRole("heading", { name: /acme dental supplies/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Pending verification")).toBeInTheDocument();
    expect(await screen.findByText("Composite Resin 4g")).toBeInTheDocument();

    const card = screen.getByText("Composite Resin 4g").closest("li");
    expect(card).toHaveTextContent(/KES\s*350/);
    expect(card).toHaveTextContent(/wholesale\s*KES\s*260/);
    expect(card).toHaveTextContent(/from 6 units/);
  });

  it("shows an error with a retry when the store request fails", async () => {
    fetchMyStoreMock.mockRejectedValue(new Error("network down"));

    renderDashboard();

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not load your store/i);
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("lists a new product from the store view", async () => {
    const user = userEvent.setup();
    fetchMyStoreMock.mockResolvedValue(STORE);
    createProductMock.mockResolvedValue(PRODUCT);

    renderDashboard();

    await user.click(await screen.findByRole("button", { name: /add product/i }));

    await user.type(screen.getByLabelText(/product name/i), "Composite Resin 4g");
    await user.type(screen.getByLabelText(/^category/i), "Restorative");
    await user.type(screen.getByLabelText(/retail price/i), "350.00");
    await user.click(screen.getByRole("button", { name: /list product/i }));

    await waitFor(() =>
      expect(createProductMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Composite Resin 4g",
          category: "Restorative",
          retailPrice: "350.00",
        }),
      ),
    );
  });

  it("edits a product and sends only the change", async () => {
    const user = userEvent.setup();
    fetchMyStoreMock.mockResolvedValue(STORE);
    fetchMyProductsMock.mockResolvedValue(page([PRODUCT]));
    updateProductMock.mockResolvedValue({ ...PRODUCT, inStock: false });

    renderDashboard();

    await user.click(await screen.findByRole("button", { name: /edit/i }));
    await user.click(screen.getByLabelText(/in stock/i));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(updateProductMock).toHaveBeenCalledWith(
        "product-1",
        expect.objectContaining({ inStock: false }),
      ),
    );
  });
});
