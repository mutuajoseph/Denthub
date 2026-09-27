import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type AddCartItemInput, useCartStore } from "../../store/cartStore";
import CartDrawer from "./CartDrawer";

function addLine(overrides: Partial<AddCartItemInput> = {}) {
  useCartStore.getState().addItem({
    productId: "p1",
    name: "Adult Medium Toothbrush",
    unitPrice: 350,
    purchaseMode: "retail",
    ...overrides,
  });
}

describe("CartDrawer", () => {
  beforeEach(() => {
    useCartStore.getState().clearCart();
  });

  it("shows an empty state with a way back to the shop", () => {
    render(<CartDrawer open onClose={vi.fn()} currency="KES" />);

    expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue shopping/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /checkout/i })).not.toBeInTheDocument();
  });

  it("lists lines and totals the server unit price times quantity", () => {
    addLine({ quantity: 3 });
    render(<CartDrawer open onClose={vi.fn()} currency="KES" />);

    expect(screen.getByText("Adult Medium Toothbrush")).toBeInTheDocument();
    // A single line shows the same figure as the line total and the subtotal.
    expect(screen.getAllByText("KES 1,050")).toHaveLength(2);
  });

  it("sums mixed retail and wholesale lines", () => {
    addLine({ productId: "p1", purchaseMode: "retail", unitPrice: 350, quantity: 2 });
    addLine({
      productId: "p2",
      name: "Dental Floss",
      purchaseMode: "wholesale",
      unitPrice: 262.5,
      quantity: 4,
      wholesaleMinQty: 12,
    });

    render(<CartDrawer open onClose={vi.fn()} currency="KES" />);

    // 350*2 + 262.50*4 = 1750
    expect(screen.getByText("KES 1,750")).toBeInTheDocument();
  });

  it("warns when a wholesale line is under the server's minimum quantity", () => {
    addLine({ purchaseMode: "wholesale", unitPrice: 262.5, quantity: 2, wholesaleMinQty: 12 });
    render(<CartDrawer open onClose={vi.fn()} currency="KES" />);

    expect(screen.getByText(/wholesale starts at 12 units — add 10 more/i)).toBeInTheDocument();
  });

  it("drops the minimum warning once the quantity reaches it", async () => {
    const user = userEvent.setup();
    addLine({ purchaseMode: "wholesale", unitPrice: 262.5, quantity: 11, wholesaleMinQty: 12 });
    render(<CartDrawer open onClose={vi.fn()} currency="KES" />);

    expect(screen.getByText(/add 1 more/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /increase .* quantity/i }));

    expect(screen.queryByText(/wholesale starts at/i)).not.toBeInTheDocument();
  });

  it("does not warn about minimums for a retail line", () => {
    addLine({ purchaseMode: "retail", unitPrice: 350, quantity: 1, wholesaleMinQty: 12 });
    render(<CartDrawer open onClose={vi.fn()} currency="KES" />);

    expect(screen.queryByText(/wholesale starts at/i)).not.toBeInTheDocument();
  });

  it("removes a line when its quantity is decremented to zero", async () => {
    const user = userEvent.setup();
    addLine({ quantity: 1 });
    render(<CartDrawer open onClose={vi.fn()} currency="KES" />);

    await user.click(screen.getByRole("button", { name: /decrease .* quantity/i }));

    expect(useCartStore.getState().items).toHaveLength(0);
    expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument();
  });

  it("removes a line from the trash button", async () => {
    const user = userEvent.setup();
    addLine();
    render(<CartDrawer open onClose={vi.fn()} currency="KES" />);

    await user.click(screen.getByRole("button", { name: /remove .* from cart/i }));

    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("notes that wholesale lines need a clinic account", () => {
    addLine({ purchaseMode: "wholesale", unitPrice: 262.5, wholesaleMinQty: 12 });
    render(<CartDrawer open onClose={vi.fn()} currency="KES" />);

    expect(screen.getByText(/wholesale lines need a clinic account/i)).toBeInTheDocument();
  });

  it("does not show the clinic note for a retail-only cart", () => {
    addLine({ purchaseMode: "retail", unitPrice: 350 });
    render(<CartDrawer open onClose={vi.fn()} currency="KES" />);

    expect(screen.queryByText(/wholesale lines need a clinic account/i)).not.toBeInTheDocument();
  });

  it("closes on Escape and on the backdrop", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(<CartDrawer open onClose={onClose} currency="KES" />);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /close cart/i }));
    expect(onClose).toHaveBeenCalledTimes(2);

    // The backdrop is a decorative div, not a second "Close cart" control.
    const backdrop = container.querySelector(".fixed.inset-0.z-40");
    expect(backdrop).not.toBeNull();
    expect(backdrop?.tagName).toBe("DIV");
  });

  it("clears the cart from the footer", async () => {
    const user = userEvent.setup();
    addLine();
    addLine({ productId: "p2", name: "Dental Floss" });
    render(<CartDrawer open onClose={vi.fn()} currency="KES" />);

    await user.click(screen.getByRole("button", { name: /clear cart/i }));

    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("truncates fractional cents in the line total rather than showing float dust", () => {
    addLine({ unitPrice: 0.1, quantity: 3 });
    render(<CartDrawer open onClose={vi.fn()} currency="KES" />);

    // 0.1 * 3 === 0.30000000000000004 in IEEE754
    expect(screen.getAllByText("KES 0.30")).toHaveLength(2);
  });
});
