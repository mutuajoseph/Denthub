import { type ReactNode, useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import type { AuthUser } from "../../lib/auth";
import { useCartUiStore } from "../../store/cartUiStore";
import Navbar from "../Navbar";
import { DentalChatbot } from "../chatbot/DentalChatbot";
import CartDrawer from "../shop/CartDrawer";
import { AnnouncementBar } from "./AnnouncementBar";
import { BackToTop } from "./BackToTop";
import { EmergencyFAB } from "./EmergencyFAB";
import { Footer } from "./Footer";
import { MobileNav } from "./MobileNav";

export interface AppShellProps {
  onSignIn?: () => void;
  user?: AuthUser | null;
  onLogout?: () => void;
  children?: ReactNode;
}

const noop = () => undefined;

export function AppShell({
  onSignIn = noop,
  user = null,
  onLogout = noop,
  children,
}: AppShellProps) {
  const { pathname } = useLocation();
  const closeCartDrawer = useCartUiStore((state) => state.closeCartDrawer);
  const lastPathname = useRef(pathname);

  // The drawer is global, so a route change has to dismiss it. Without this it
  // survives navigation and sits over the next page.
  useEffect(() => {
    if (lastPathname.current === pathname) return;

    lastPathname.current = pathname;
    closeCartDrawer();
  }, [pathname, closeCartDrawer]);

  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden">
      <a
        href="#main-content"
        className="sr-only z-[100] rounded-lg bg-gold-400 px-4 py-2 font-semibold text-navy-900 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>
      <div className="sticky top-0 z-50 w-full">
        <AnnouncementBar />
        <Navbar onSignIn={onSignIn} user={user} onLogout={onLogout} />
      </div>
      <main
        id="main-content"
        tabIndex={-1}
        className="min-w-0 flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] focus:outline-none md:pb-0"
      >
        {children ?? <Outlet />}
      </main>
      <Footer />
      <MobileNav />
      <EmergencyFAB />
      <DentalChatbot />
      <BackToTop />
      {/* Single global cart surface, opened from the navbar or the shop page. */}
      <CartDrawer />
    </div>
  );
}

export const RouteShell = AppShell;
