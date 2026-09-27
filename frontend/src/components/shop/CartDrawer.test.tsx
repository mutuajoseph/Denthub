import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { type AddCartItemInput, useCartStore } from "../../store/cartStore";
import { useCartUiStore } from "../../store/cartUiStore";
import CartDrawer from "./CartDrawer";

function addLine(overrides: Partial<AddCartItemInput> = {}) {
  useCartStore.getState().addItem({
    productId: "p1",
    name: "Adult Medium Toothbrush",
    unitPrice: 350,
    purchaseMode: "retail",
    currency: "KES",
    ...overrides,
  });
}

/** Render the drawer in its open state, as `AppShell` leaves it. */
function renderOpenDrawer() {
  act(() => useCartUiStore.getState().openCartDrawer());
  return render(<CartDrawer />);
}

describe("CartDrawer", () => {
  beforeEach(() => {
    useCartStore.getState().clearCart();
    useCartUiStore.setState({ isDrawerOpen: true });
  });

  it("stays mounted but off-screen when closed, so it is not a tab trap", () => {
    useCartUiStore.setState({ isDrawerOpen: false });
    const { container } = render(<CartDrawer />);

    const panel = container.querySelector("dialog");
    expect(panel).not.toBeNull();
    expect(panel?.className).toContain("translate-x-full");
  });

  it("shows an empty state with a way back to the shop", () => {
    renderOpenDrawer();

    expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue shopping/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /checkout/i })).not.toBeInTheDocument();
  });

  it("lists lines and totals the server unit price times quantity", () => {
    addLine({ quantity: 3 });
    renderOpenDrawer();

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

    renderOpenDrawer();

    // 350*2 + 262.50*4 = 1750
    expect(screen.getByText("KES 1,750")).toBeInTheDocument();
  });

  it("warns when a wholesale line is under the server's minimum quantity", () => {
    addLine({ purchaseMode: "wholesale", unitPrice: 262.5, quantity: 2, wholesaleMinQty: 12 });
    renderOpenDrawer();

    expect(screen.getByText(/wholesale starts at 12 units — add 10 more/i)).toBeInTheDocument();
  });

  it("drops the minimum warning once the quantity reaches it", async () => {
    const user = userEvent.setup();
    addLine({ purchaseMode: "wholesale", unitPrice: 262.5, quantity: 11, wholesaleMinQty: 12 });
    renderOpenDrawer();

    expect(screen.getByText(/add 1 more/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /increase .* quantity/i }));

    expect(screen.queryByText(/wholesale starts at/i)).not.toBeInTheDocument();
  });

  it("does not warn about minimums for a retail line", () => {
    addLine({ purchaseMode: "retail", unitPrice: 350, quantity: 1, wholesaleMinQty: 12 });
    renderOpenDrawer();

    expect(screen.queryByText(/wholesale starts at/i)).not.toBeInTheDocument();
  });

  it("removes a line when its quantity is decremented to zero", async () => {
    const user = userEvent.setup();
    addLine({ quantity: 1 });
    renderOpenDrawer();

    await user.click(screen.getByRole("button", { name: /decrease .* quantity/i }));

    expect(useCartStore.getState().items).toHaveLength(0);
    expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument();
  });

  it("removes a line from the trash button", async () => {
    const user = userEvent.setup();
    addLine();
    renderOpenDrawer();

    await user.click(screen.getByRole("button", { name: /remove .* from cart/i }));

    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("notes that wholesale lines need a clinic account", () => {
    addLine({ purchaseMode: "wholesale", unitPrice: 262.5, wholesaleMinQty: 12 });
    renderOpenDrawer();

    expect(screen.getByText(/wholesale lines need a clinic account/i)).toBeInTheDocument();
  });

  it("does not show the clinic note for a retail-only cart", () => {
    addLine({ purchaseMode: "retail", unitPrice: 350 });
    renderOpenDrawer();

    expect(screen.queryByText(/wholesale lines need a clinic account/i)).not.toBeInTheDocument();
  });

  it("closes on Escape and on the close button via the ui store", async () => {
    const user = userEvent.setup();
    renderOpenDrawer();

    expect(useCartUiStore.getState().isDrawerOpen).toBe(true);

    await user.keyboard("{Escape}");
    expect(useCartUiStore.getState().isDrawerOpen).toBe(false);

    act(() => useCartUiStore.getState().openCartDrawer());
    await user.click(screen.getByRole("button", { name: /close cart/i }));
    expect(useCartUiStore.getState().isDrawerOpen).toBe(false);
  });

  it("closes when the backdrop is clicked, and the backdrop is not a second close control", async () => {
    const user = userEvent.setup();
    const { container } = renderOpenDrawer();

    const backdrop = container.querySelector(".fixed.inset-0");
    expect(backdrop?.tagName).toBe("DIV");
    expect(backdrop).toHaveAttribute("aria-hidden", "true");

    // Only one "Close cart" control exists, in the drawer header.
    expect(screen.getAllByRole("button", { name: /close cart/i })).toHaveLength(1);

    await user.click(backdrop as Element);
    expect(useCartUiStore.getState().isDrawerOpen).toBe(false);
  });

  it("puts the backdrop above the sticky header so the nav is inert", () => {
    const { container } = renderOpenDrawer();

    const backdrop = container.querySelector(".fixed.inset-0");
    const zIndex = Number.parseInt(/z-\[(\d+)\]/.exec(backdrop?.className ?? "")?.[1] ?? "0", 10);

    // AppShell pins the header at z-50.
    expect(zIndex).toBeGreaterThan(50);
  });

  it("clears the cart from the footer", async () => {
    const user = userEvent.setup();
    addLine();
    addLine({ productId: "p2", name: "Dental Floss" });
    renderOpenDrawer();

    await user.click(screen.getByRole("button", { name: /clear cart/i }));

    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("truncates fractional cents in the line total rather than showing float dust", () => {
    addLine({ unitPrice: 0.1, quantity: 3 });
    renderOpenDrawer();

    // 0.1 * 3 === 0.30000000000000004 in IEEE754
    expect(screen.getAllByText("KES 0.30")).toHaveLength(2);
  });
});
