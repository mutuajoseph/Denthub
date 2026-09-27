import { create } from "zustand";

/**
 * Visibility of the single global cart drawer.
 *
 * The drawer used to be rendered twice — a navbar dropdown and a shop-page
 * drawer — which let the two drift apart on price formatting. There is now one
 * `CartDrawer` instance in `AppShell`; this store is how the navbar button and
 * the shop page's own button both open it.
 *
 * Deliberately not persisted: the drawer should never reopen on reload.
 */
interface CartUiState {
  isDrawerOpen: boolean;
  openCartDrawer: () => void;
  closeCartDrawer: () => void;
}

export const useCartUiStore = create<CartUiState>()((set) => ({
  isDrawerOpen: false,
  openCartDrawer: () => set({ isDrawerOpen: true }),
  closeCartDrawer: () => set({ isDrawerOpen: false }),
}));
