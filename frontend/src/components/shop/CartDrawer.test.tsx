import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROLE } from "../../auth/roles";
import type { AuthUser } from "../../lib/auth";
import { startConversation } from "../../lib/messagesApi";
import { type AddCartItemInput, useCartStore } from "../../store/cartStore";
import { useCartUiStore } from "../../store/cartUiStore";
import CartDrawer from "./CartDrawer";

vi.mock("../../lib/messagesApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/messagesApi")>();
  return { ...actual, startConversation: vi.fn() };
});

const signedInUser = {
  id: "user-1",
  email: "test@example.com",
  full_name: "Test User",
  phone: null,
  home_country_code: null,
  role: ROLE.PATIENT,
  is_staff: false,
  account_status: "active",
  email_verified: true,
  profiles: [],
  memberships: [],
} as AuthUser;

function LocationProbe() {
  const { pathname } = useLocation();
  return <div data-testid="pathname">{pathname}</div>;
}

function addLine(overrides: Partial<AddCartItemInput> = {}) {
  useCartStore.getState().addItem({
    productId: "p1",
    name: "Adult Medium Toothbrush",
    unitPrice: "350.00",
    purchaseMode: "retail",
    currency: "KES",
    supplierId: "s1",
    supplierName: "Nairobi Dental Supplies",
    supplierUserId: "user-s1",
    ...overrides,
  });
}

/** Render the drawer in its open state, as `AppShell` leaves it. */
function renderOpenDrawer(user: AuthUser | null = null, onSignIn = vi.fn()) {
  act(() => useCartUiStore.getState().openCartDrawer());
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/shop"]}>
        <CartDrawer user={user} onSignIn={onSignIn} />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CartDrawer", () => {
  beforeEach(() => {
    useCartStore.getState().clearCart();
    useCartUiStore.setState({ isDrawerOpen: true });
    vi.mocked(startConversation).mockReset();
    vi.mocked(startConversation).mockResolvedValue(
      {} as Awaited<ReturnType<typeof startConversation>>,
    );
  });

  it("is fully removed from the DOM when closed, so nothing can linger or trap tabs", async () => {
    const { container } = renderOpenDrawer();
    expect(container.querySelector("dialog")).not.toBeNull();

    act(() => useCartUiStore.getState().closeCartDrawer());

    // Unmounted after the exit animation rather than merely translated
    // off-screen: a lingering `position: fixed` panel is what left the cart
    // stuck over the page.
    await waitFor(() => expect(container.querySelector("dialog")).toBeNull());
    expect(container.querySelector(".fixed.inset-0")).toBeNull();
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
    addLine({ productId: "p1", purchaseMode: "retail", unitPrice: "350.00", quantity: 2 });
    addLine({
      productId: "p2",
      name: "Dental Floss",
      purchaseMode: "wholesale",
      unitPrice: "262.50",
      quantity: 4,
      wholesaleMinQty: 12,
    });

    renderOpenDrawer();

    // 350*2 + 262.50*4 = 1750
    expect(screen.getByText("KES 1,750")).toBeInTheDocument();
  });

  it("switches a wholesale line to retail when quantity drops below the minimum", async () => {
    const user = userEvent.setup();
    addLine({
      purchaseMode: "wholesale",
      unitPrice: "262.50",
      retailUnitPrice: "350.00",
      wholesaleUnitPrice: "262.50",
      quantity: 12,
      wholesaleMinQty: 12,
    });
    renderOpenDrawer();

    expect(screen.getByText("Wholesale")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /decrease .* quantity/i }));

    expect(useCartStore.getState().items[0]).toMatchObject({
      purchaseMode: "retail",
      unitPrice: "350.00",
      quantity: 11,
    });
    expect(screen.queryByText(/wholesale starts at/i)).not.toBeInTheDocument();
  });

  it("switches back to wholesale when quantity reaches the threshold", async () => {
    const user = userEvent.setup();
    addLine({
      purchaseMode: "wholesale",
      unitPrice: "262.50",
      retailUnitPrice: "350.00",
      wholesaleUnitPrice: "262.50",
      quantity: 11,
      wholesaleMinQty: 12,
    });
    renderOpenDrawer();

    await user.click(screen.getByRole("button", { name: /increase .* quantity/i }));

    expect(useCartStore.getState().items[0]).toMatchObject({
      purchaseMode: "wholesale",
      unitPrice: "262.50",
      quantity: 12,
    });
  });

  it("does not warn about minimums for a retail line", () => {
    addLine({ purchaseMode: "retail", unitPrice: "350.00", quantity: 1, wholesaleMinQty: 12 });
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
    addLine({ purchaseMode: "wholesale", unitPrice: "262.50", wholesaleMinQty: 12 });
    renderOpenDrawer();

    expect(screen.getByText(/wholesale lines need a clinic account/i)).toBeInTheDocument();
  });

  it("does not show the clinic note for a retail-only cart", () => {
    addLine({ purchaseMode: "retail", unitPrice: "350.00" });
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

  it("keeps the line total and subtotal exact for a repeating float value", () => {
    addLine({ unitPrice: "0.10", quantity: 3 });
    renderOpenDrawer();

    // 0.1 * 3 === 0.30000000000000004 in IEEE754; the cart never touches a float.
    expect(screen.getAllByText("KES 0.30")).toHaveLength(2);
  });

  it("checks out by starting one shop conversation per supplier", async () => {
    const user = userEvent.setup();
    addLine();
    addLine({
      productId: "p2",
      name: "Dental Floss",
      supplierId: "s2",
      supplierName: "Global Smile Imports",
      supplierUserId: "user-s2",
      unitPrice: "262.50",
      quantity: 2,
    });
    renderOpenDrawer(signedInUser);

    await user.click(screen.getByRole("button", { name: /checkout/i }));

    await waitFor(() => expect(startConversation).toHaveBeenCalledTimes(2));
    expect(startConversation).toHaveBeenCalledWith(
      "user-s1",
      expect.stringContaining("Adult Medium Toothbrush — 1 × KES"),
    );
    expect(startConversation).toHaveBeenCalledWith(
      "user-s2",
      expect.stringContaining("Dental Floss"),
    );
    expect(useCartStore.getState().items).toHaveLength(0);
    expect(screen.getByTestId("pathname")).toHaveTextContent("/messages");
  });

  it("keeps the cart and reports a failed conversation request", async () => {
    const user = userEvent.setup();
    vi.mocked(startConversation).mockRejectedValueOnce(new Error("offline"));
    addLine();
    renderOpenDrawer(signedInUser);

    await user.click(screen.getByRole("button", { name: /checkout/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/cart is unchanged/i);
    expect(useCartStore.getState().items).toHaveLength(1);
  });

  it("opens the sign-in modal for a signed-out visitor without losing the cart", async () => {
    const user = userEvent.setup();
    const onSignIn = vi.fn();
    addLine();
    renderOpenDrawer(null, onSignIn);

    await user.click(screen.getByRole("button", { name: /checkout/i }));

    expect(onSignIn).toHaveBeenCalledOnce();
    expect(screen.getByTestId("pathname")).toHaveTextContent("/shop");
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(startConversation).not.toHaveBeenCalled();
  });

  it("asks for a re-add when a line has no shop", async () => {
    const user = userEvent.setup();
    addLine({ supplierUserId: "" });
    renderOpenDrawer(signedInUser);

    await user.click(screen.getByRole("button", { name: /checkout/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/no shop attached/i);
    expect(startConversation).not.toHaveBeenCalled();
  });
});
