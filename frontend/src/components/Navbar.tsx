import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Building2,
  ChevronDown,
  GraduationCap,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Newspaper,
  ShoppingBag,
  ShoppingCart,
  Stethoscope,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";

import {
  ROLE,
  canAccessFacility,
  getDashboardPath,
  isStaffUser,
  isSupplierUser,
  isTrainingProviderUser,
} from "../auth/roles";
import { useRegion } from "../hooks/useRegion";
import type { AuthUser } from "../lib/auth";
import { selectCartCount, useCartStore } from "../store/cartStore";
import { useCartUiStore } from "../store/cartUiStore";
import { cn } from "../utils/cn";
import CountrySelector from "./CountrySelector";

type NavbarProps = {
  onSignIn: () => void;
  user: AuthUser | null;
  onLogout: () => void;
};

export const NAV_LINKS = [
  { label: "Home", href: "/", icon: Home },
  { label: "About", href: "/about", icon: BookOpen },
  { label: "Find a Dentist", href: "/dentists", icon: Stethoscope },
  { label: "Oral Care Shop", href: "/shop", icon: ShoppingBag },
  { label: "Jobs", href: "/jobs", icon: Briefcase },
  { label: "Training", href: "/training", icon: GraduationCap },
  { label: "Magazine", href: "/magazine", icon: Newspaper },
];

type AccountLink = { label: string; href: string; icon: LucideIcon };

/** Account destinations the signed-in user may open, in menu order. */
function accountLinksFor(user: AuthUser): AccountLink[] {
  const links: AccountLink[] = [
    { label: "Dashboard", href: getDashboardPath(ROLE.PATIENT), icon: LayoutDashboard },
  ];
  if (canAccessFacility(user)) {
    links.push({
      label: "Facility",
      href: getDashboardPath(ROLE.FACILITY_OWNER),
      icon: Building2,
    });
  }
  if (isTrainingProviderUser(user)) {
    links.push({
      label: "Training",
      href: getDashboardPath(ROLE.TRAINING_PROVIDER),
      icon: GraduationCap,
    });
  }
  if (isSupplierUser(user)) {
    links.push({ label: "My store", href: getDashboardPath(ROLE.SUPPLIER), icon: ShoppingBag });
  }
  if (!isStaffUser(user)) {
    links.push({ label: "Messages", href: "/messages", icon: MessageCircle });
  }
  return links;
}

/** Splits "DentHub USA" into the wordmark and its Country suffix. */
function splitBrand(brandName: string): { mark: string; suffix: string } {
  const end = brandName.indexOf("Hub");
  if (end < 0) return { mark: brandName, suffix: "" };
  return {
    mark: brandName.slice(0, end + 3),
    suffix: brandName.slice(end + 3).trim(),
  };
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-button bg-graphite text-sm font-semibold text-paper"
      aria-hidden="true"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export default function Navbar({ onSignIn, user, onLogout }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const cartCount = useCartStore((s) => selectCartCount(s.items));
  const openCartDrawer = useCartUiStore((s) => s.openCartDrawer);
  const { brandName } = useRegion();
  const { mark, suffix } = splitBrand(brandName);
  const accountLinks = user ? accountLinksFor(user) : [];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!user) setUserMenuOpen(false);
  }, [user]);

  const handleLogout = () => {
    setUserMenuOpen(false);
    setMobileOpen(false);
    onLogout();
  };

  const closeMenus = () => {
    setMobileOpen(false);
    setUserMenuOpen(false);
  };

  return (
    <header className="relative z-50 w-full border-b border-steel bg-paper text-ink">
      <nav
        className="mx-auto grid w-full max-w-[1440px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-3 sm:px-6 lg:px-10 xl:gap-x-6"
        aria-label="Main navigation"
      >
        <a
          href="/"
          aria-label={`${brandName} home`}
          className="flex min-w-0 items-center gap-2 whitespace-nowrap rounded-link"
        >
          <span
            className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] bg-graphite shadow-edge"
            aria-hidden="true"
          >
            <span className="h-2 w-2 rounded-[2px] bg-aqua-relay" />
          </span>
          <span className="font-display text-[19px] font-semibold tracking-[-0.03em] text-ink sm:text-[21px]">
            {mark}
          </span>
          {suffix && (
            <span className="font-mono text-[11px] font-normal uppercase tracking-[0.06em] text-slate">
              {suffix}
            </span>
          )}
        </a>

        <div className="hidden min-w-0 items-center justify-center xl:flex">
          <ul className="flex max-w-full items-center gap-6">
            {NAV_LINKS.map(({ label, href }) => (
              <li key={label}>
                <NavLink
                  to={href}
                  end={href === "/"}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 whitespace-nowrap rounded-link py-2 text-sm font-medium leading-none transition-colors",
                      isActive ? "text-ink" : "text-slate hover:text-ink",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span
                          className="h-1.5 w-1.5 rounded-[1px] bg-aqua-relay ring-1 ring-ink/20"
                          aria-hidden="true"
                        />
                      )}
                      {label}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex min-w-0 shrink-0 items-center justify-end gap-2 sm:gap-4">
          <CountrySelector onNavigate={closeMenus} />

          <button
            type="button"
            aria-label="Shopping cart"
            onClick={openCartDrawer}
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-button text-ink transition-colors hover:bg-cloud"
          >
            <ShoppingCart className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" />
            {cartCount > 0 && (
              <span className="tabular absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-ink px-1 text-[10px] font-semibold leading-none text-paper">
                {cartCount}
              </span>
            )}
          </button>

          {user ? (
            <div ref={userMenuRef} className="relative z-[100]">
              <button
                type="button"
                onClick={() => setUserMenuOpen((open) => !open)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                aria-label={`Account menu for ${user.full_name}`}
                className="flex h-10 max-w-[260px] items-center gap-2 rounded-button py-1 pl-1 pr-2 transition-colors hover:bg-cloud"
              >
                <Avatar name={user.full_name ?? ""} />
                <span className="hidden min-w-0 max-w-[160px] truncate text-sm font-medium text-ink lg:inline">
                  {user.full_name}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-slate transition-transform duration-200",
                    userMenuOpen && "rotate-180",
                  )}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </button>

              {userMenuOpen && (
                <div
                  role="menu"
                  aria-label="Account menu"
                  className="absolute right-0 top-full z-[99999] mt-2 w-[248px] overflow-hidden rounded-card bg-paper p-1.5 shadow-card-cloud"
                >
                  <div className="px-3 pb-2 pt-2.5">
                    <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-slate">
                      Signed in as
                    </p>
                    <p className="mt-1 truncate text-sm font-medium text-ink">{user.full_name}</p>
                  </div>
                  {accountLinks.map(({ label, href, icon: Icon }) => (
                    <a
                      key={label}
                      href={href}
                      role="menuitem"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex w-full items-center gap-3 rounded-button px-3 py-2.5 text-sm font-medium text-charcoal transition-colors hover:bg-cloud hover:text-ink"
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" />
                      {label}
                    </a>
                  ))}
                  <div className="my-1 h-px bg-steel" aria-hidden="true" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-button px-3 py-2.5 text-left text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" />
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              className="hidden min-h-10 items-center gap-2 rounded-button bg-graphite px-4 py-2 text-sm font-medium leading-none text-paper shadow-edge transition-colors hover:bg-ink sm:inline-flex"
            >
              Sign in
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
            </button>
          )}

          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-button text-ink transition-colors hover:bg-cloud xl:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div id="mobile-navigation" className="border-t border-steel bg-paper px-4 py-3 xl:hidden">
          <ul className="space-y-0.5">
            {NAV_LINKS.map(({ label, href, icon: Icon }) => (
              <li key={label}>
                <NavLink
                  to={href}
                  end={href === "/"}
                  onClick={closeMenus}
                  className={({ isActive }) =>
                    cn(
                      "flex min-h-11 items-center gap-3 rounded-button px-3 text-[15px] font-medium transition-colors",
                      isActive
                        ? "bg-cloud text-ink"
                        : "text-charcoal hover:bg-cloud hover:text-ink",
                    )
                  }
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} aria-hidden="true" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="mt-3 border-t border-steel pt-3">
            {user ? (
              <div className="space-y-0.5">
                <div className="mb-2 flex items-center gap-3 rounded-button bg-cloud px-3 py-2.5">
                  <Avatar name={user.full_name ?? ""} />
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-slate">
                      Signed in as
                    </p>
                    <p className="truncate text-sm font-medium text-ink">{user.full_name}</p>
                  </div>
                </div>
                {accountLinks.map(({ label, href, icon: Icon }) => (
                  <a
                    key={label}
                    href={href}
                    onClick={closeMenus}
                    className="flex min-h-11 w-full items-center gap-3 rounded-button px-3 text-sm font-medium text-charcoal transition-colors hover:bg-cloud hover:text-ink"
                  >
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} aria-hidden="true" />
                    {label}
                  </a>
                ))}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex min-h-11 w-full items-center gap-3 rounded-button px-3 text-left text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
                >
                  <LogOut className="h-[18px] w-[18px]" strokeWidth={1.7} aria-hidden="true" />
                  Log out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  onSignIn();
                }}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-button bg-graphite px-4 text-sm font-medium text-paper shadow-edge transition-colors hover:bg-ink"
              >
                Sign in
                <ArrowRight className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
