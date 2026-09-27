import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { mapProduct } from "../../lib/productApi";
import { useCartStore } from "../../store/cartStore";
import ProductCard from "./ProductCard";

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn() },
}));

const wholesaleProduct = mapProduct({
  id: "p-wholesale",
  name: "Adult Medium Toothbrush",
  brand: "Oral-B",
  category: "brushing",
  description: "Medium bristles for adults.",
  image_url: null,
  country_code: "KE",
  dentist_recommended: true,
  in_stock: true,
  supplier: {
    id: "s1",
    name: "Nairobi Dental Supplies",
    slug: "nairobi-dental-supplies",
    scope: "local",
    is_verified: true,
  },
  // 350 * 0.75 = 262.50 — the server already applied the 25% default.
  pricing: {
    currency: "KES",
    quantity: 1,
    purchase_mode: "retail",
    unit_price: "350.00",
    line_total: "350.00",
    retail_price: "350.00",
    wholesale_price: "262.50",
    wholesale_min_qty: 12,
  },
  created_at: "2026-09-27T07:21:09",
});

const retailOnlyProduct = mapProduct({
  ...wholesaleProduct,
  id: "p-retail",
  name: "Travel Toothbrush",
  category: "specialty",
  pricing: {
    ...wholesaleProduct.pricing,
    wholesale_price: null,
    wholesale_min_qty: 0,
  },
} as never);

describe("ProductCard", () => {
  beforeEach(() => {
    useCartStore.getState().clearCart();
  });

  it("shows the dentist-recommended flag, brand and supplier", () => {
    render(<ProductCard product={wholesaleProduct} />);

    expect(screen.getByText("Dentist Recommended")).toBeInTheDocument();
    expect(screen.getByText("Oral-B")).toBeInTheDocument();
    expect(screen.getByText(/Nairobi Dental Supplies/)).toBeInTheDocument();
  });

  it("renders a category placeholder when the product has no image", () => {
    const { container } = render(<ProductCard product={wholesaleProduct} />);

    expect(container.querySelector("img")).toBeNull();
    // from-sky-500 is the brushing gradient — a real class, not `undefined`.
    expect(container.querySelector(".from-sky-500")).not.toBeNull();
    expect(container.innerHTML).not.toContain("undefined");
  });

  it("defaults to the retail price from the server", () => {
    render(<ProductCard product={wholesaleProduct} />);

    expect(screen.getByText("KES 350")).toBeInTheDocument();
  });

  it("switches to the server's wholesale price when wholesale is selected", async () => {
    const user = userEvent.setup();
    render(<ProductCard product={wholesaleProduct} />);

    await user.click(screen.getByRole("button", { name: "wholesale" }));

    // Cents are preserved: 262.50 must not render as a rounded 263.
    expect(screen.getByText("KES 262.50")).toBeInTheDocument();
  });

  it("adds the retail price to the cart by default", async () => {
    const user = userEvent.setup();
    render(<ProductCard product={wholesaleProduct} />);

    await user.click(screen.getByRole("button", { name: /add to cart/i }));

    const [line] = useCartStore.getState().items;
    expect(line).toMatchObject({
      productId: "p-wholesale",
      purchaseMode: "retail",
      unitPrice: 350,
      quantity: 1,
      wholesaleMinQty: 12,
    });
  });

  it("freezes the wholesale price into the cart line", async () => {
    const user = userEvent.setup();
    render(<ProductCard product={wholesaleProduct} />);

    await user.click(screen.getByRole("button", { name: "wholesale" }));
    await user.click(screen.getByRole("button", { name: /add wholesale/i }));

    const [line] = useCartStore.getState().items;
    expect(line).toMatchObject({ purchaseMode: "wholesale", unitPrice: 262.5 });
  });

  it("keeps retail and wholesale as separate cart lines", async () => {
    const user = userEvent.setup();
    render(<ProductCard product={wholesaleProduct} />);

    await user.click(screen.getByRole("button", { name: /add to cart/i }));
    await user.click(screen.getByRole("button", { name: "wholesale" }));
    await user.click(screen.getByRole("button", { name: /add wholesale/i }));

    const items = useCartStore.getState().items;
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.cartLineId)).toEqual(["p-wholesale-retail", "p-wholesale-wholesale"]);
  });

  it("omits the mode toggle for a retail-only product", () => {
    render(<ProductCard product={retailOnlyProduct} />);

    expect(screen.queryByRole("button", { name: "wholesale" })).not.toBeInTheDocument();
    expect(screen.queryByText(/wholesale from/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add to cart/i })).toBeInTheDocument();
  });
});
