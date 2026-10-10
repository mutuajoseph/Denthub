import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCartStore } from "../../store/cartStore";
import { useCartUiStore } from "../../store/cartUiStore";
import { AppShell } from "./AppShell";

vi.mock("../../lib/countryConfigApi", () => ({
  fetchCountries: vi.fn().mockResolvedValue({ items: [], default_country_code: "KE" }),
  fetchCountryConfig: vi.fn(),
  fetchSpecialties: vi.fn(),
}));

function newClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  });
}

function renderShell() {
  return render(
    <QueryClientProvider client={newClient()}>
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AppShell cart", () => {
  beforeEach(() => {
    useCartStore.getState().clearCart();
    useCartUiStore.setState({ isDrawerOpen: false });
  });

  it("renders exactly one cart drawer when open", () => {
    renderShell();
    expect(screen.queryByRole("dialog", { name: /shopping cart/i })).toBeNull();

    act(() => useCartUiStore.getState().openCartDrawer());
    expect(screen.getAllByRole("dialog", { name: /shopping cart/i })).toHaveLength(1);
  });

  it("opens the drawer from the navbar cart button", async () => {
    const user = userEvent.setup();
    renderShell();

    expect(useCartUiStore.getState().isDrawerOpen).toBe(false);

    await user.click(screen.getByRole("button", { name: "Shopping cart" }));

    expect(useCartUiStore.getState().isDrawerOpen).toBe(true);
  });

  it("shows the added line in the drawer opened from the navbar", async () => {
    const user = userEvent.setup();

    useCartStore.getState().addItem({
      productId: "p1",
      name: "Adult Medium Toothbrush",
      unitPrice: 350,
      purchaseMode: "retail",
      currency: "KES",
    });

    renderShell();
    await user.click(screen.getByRole("button", { name: "Shopping cart" }));

    const drawer = screen.getByRole("dialog", { name: /shopping cart/i });
    expect(drawer).toHaveTextContent("Adult Medium Toothbrush");
    expect(drawer).toHaveTextContent("KES 350");
  });

  it("dismisses the drawer when the route changes", async () => {
    const user = userEvent.setup();

    function NavigatingShell() {
      const navigate = useNavigate();

      return (
        <>
          <button type="button" onClick={() => navigate("/jobs")}>
            Go to jobs
          </button>
          <AppShell />
        </>
      );
    }

    render(
      <QueryClientProvider client={newClient()}>
        <MemoryRouter initialEntries={["/shop"]}>
          <NavigatingShell />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Shopping cart" }));
    expect(useCartUiStore.getState().isDrawerOpen).toBe(true);

    await user.click(screen.getByRole("button", { name: /go to jobs/i }));

    await waitFor(() => expect(useCartUiStore.getState().isDrawerOpen).toBe(false));
  });

  it("keeps the navbar badge in step with the cart", async () => {
    renderShell();

    const badge = () => screen.getByRole("button", { name: "Shopping cart" }).textContent;

    expect(badge()).not.toContain("1");

    await act(async () => {
      useCartStore.getState().addItem({
        productId: "p1",
        name: "Adult Medium Toothbrush",
        unitPrice: 350,
        purchaseMode: "retail",
        currency: "KES",
      });
    });

    expect(badge()).toContain("1");
  });
});
