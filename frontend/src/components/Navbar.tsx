import {
  ArrowRight,
  BookOpen,
  Briefcase,
  ChevronDown,
  GraduationCap,
  Home,
  LogOut,
  Newspaper,
  ShoppingBag,
  ShoppingCart,
  Stethoscope,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";

import brandLogo from "../assets/brand/denthub-logo.png";
import {
  isAdminRole,
  isFacilityRole,
  isOperationsRole,
  isPublicRole,
  isSupplierRole,
  isTrainingProviderRole,
} from "../auth/roles";
import { splitBrand } from "../config/regions";
import { useRegion } from "../hooks/useRegion";
import type { AuthUser } from "../lib/auth";
import { selectCartCount, useCartStore } from "../store/cartStore";
import { useCartUiStore } from "../store/cartUiStore";
import { cn } from "../utils/cn";
import CountrySelector from "./CountrySelector";
import Button from "./ui/Button";

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

type AccountLink = { label: string; href: string };

/**
 * Account destinations the signed-in user may open, in menu order. Screens land
 * here as their routes appear (#67). Facility accounts get their own "Facility"
 * entry to the clinic dashboard (#81); public accounts get the account shell,
 * the messaging inbox (#77) and, where it applies, their supplier store or
 * training dashboard. See #58 and #75.
 */
function accountLinksFor(user: AuthUser): AccountLink[] {
  if (isAdminRole(user)) {
    return [{ label: "Admin console", href: "/admin" }];
  }

  if (isOperationsRole(user)) {
    return [{ label: "Operations console", href: "/operations" }];
  }

  if (isFacilityRole(user)) {
    return [
      { label: "Facility", href: "/dashboard/facility" },
      { label: "Settings", href: "/settings" },
    ];
  }

  if (!isPublicRole(user)) {
    return [];
  }

  const links: AccountLink[] = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Messages", href: "/messages" },
  ];

  if (isSupplierRole(user)) {
    links.push({ label: "My store", href: "/dashboard/supplier" });
  }

  if (isTrainingProviderRole(user)) {
    links.push({ label: "Training", href: "/dashboard/training" });
  }

  links.push({ label: "Settings", href: "/settings" });

  return links;
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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const cartCount = useCartStore((s) => selectCartCount(s.items));
  const openCartDrawer = useCartUiStore((s) => s.openCartDrawer);
  const { brandName } = useRegion();
  const { suffix } = splitBrand(brandName);
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
    onLogout();
  };

  const closeMenus = () => setUserMenuOpen(false);

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
          <img src={brandLogo} alt="" className="h-14 w-auto shrink-0" />
          {suffix && (
            <span className="font-mono text-[11px] font-normal uppercase tracking-[0.06em] text-slate">
              {suffix}
            </span>
          )}
        </a>

        <div className="hidden min-w-0 items-center justify-center lg:flex">
          <ul className="flex max-w-full items-center gap-1.5 xl:gap-3">
            {NAV_LINKS.map(({ label, href, icon: Icon }) => (
              <li key={label}>
                <NavLink
                  to={href}
                  end={href === "/"}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-1.5 whitespace-nowrap rounded-link px-2.5 py-2.5 text-[15px] font-medium leading-none transition-colors xl:gap-2",
                      isActive ? "text-ink" : "text-slate hover:text-ink",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-[1px] bg-aqua-relay ring-1 ring-ink/20"
                          aria-hidden="true"
                        />
                      )}
                      <Icon
                        className="hidden h-4 w-4 shrink-0 xl:block xl:h-[18px] xl:w-[18px]"
                        strokeWidth={1.7}
                        aria-hidden="true"
                      />
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
                    <p className="text-xs font-medium text-slate">Signed in as</p>
                    <p className="mt-1 truncate text-sm font-medium text-ink">{user.full_name}</p>
                  </div>
                  {accountLinks.map(({ label, href }) => (
                    <Link
                      key={label}
                      to={href}
                      role="menuitem"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex w-full items-center gap-3 rounded-button px-3 py-2.5 text-sm font-medium text-charcoal transition-colors hover:bg-cloud hover:text-ink"
                    >
                      {label}
                    </Link>
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
            <Button
              variant="graphite"
              trailingIcon={ArrowRight}
              onClick={onSignIn}
              className="min-h-10 px-2.5 sm:px-4"
            >
              Sign in
            </Button>
          )}
        </div>
      </nav>
    </header>
  );
}
