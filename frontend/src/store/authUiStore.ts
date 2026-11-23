import { create } from "zustand";

type AuthUiState = {
  isOpen: boolean;
  returnTo: string | null;
  openAuthModal: (returnTo?: string) => void;
  closeAuthModal: () => void;
};

/** Only same-origin paths may be used as a post-sign-in destination. */
function safeReturnTo(path: string | undefined): string | null {
  if (
    typeof path !== "string" ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\")
  ) {
    return null;
  }

  return path;
}

/**
 * The single auth surface is a modal. RouteGuard and ResetPassword open it
 * through this store; App renders it and honours the stored return path. It is
 * deliberately not persisted — a reload should never reopen a modal.
 */
export const useAuthUiStore = create<AuthUiState>()((set) => ({
  isOpen: false,
  returnTo: null,
  openAuthModal: (returnTo) => set({ isOpen: true, returnTo: safeReturnTo(returnTo) }),
  closeAuthModal: () => set({ isOpen: false, returnTo: null }),
}));
