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
  Moon,
  Newspaper,
  ShoppingBag,
  ShoppingCart,
  Stethoscope,
  Sun,
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
import { useThemeStore } from "../store/themeStore";
import CartDropdown from "./CartDropdown";
import CountrySelector from "./CountrySelector";

type NavbarProps = {
  onSignIn: () => void;
  user: AuthUser | null;
  onLogout: () => void;
};

const NAV_LINKS = [
  { label: "Home", href: "/", icon: Home },
  { label: "About", href: "/about", icon: BookOpen },
  { label: "Find a Dentist", href: "/dentists", icon: Stethoscope },
  { label: "Oral Care Shop", href: "/shop", icon: ShoppingBag },
  { label: "Jobs", href: "/jobs", icon: Briefcase },
  { label: "Training", href: "/training", icon: GraduationCap },
  { label: "Magazine", href: "/magazine", icon: Newspaper },
];

const PUBLIC_DASHBOARD_PATH = getDashboardPath(ROLE.PATIENT);
const FACILITY_DASHBOARD_PATH = getDashboardPath(ROLE.FACILITY_OWNER);
const TRAINING_DASHBOARD_PATH = getDashboardPath(ROLE.TRAINING_PROVIDER);
const SUPPLIER_DASHBOARD_PATH = getDashboardPath(ROLE.SUPPLIER);

/* =========================================================
   NAVBAR
========================================================= */

export default function Navbar({ onSignIn, user, onLogout }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const cartRef = useRef<HTMLDivElement>(null);

  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const cartCount = useCartStore((s) => selectCartCount(s.items));
  const { brandName } = useRegion();

  const hubIndex = brandName.indexOf("Hub");
  const brandPrefix = hubIndex > 0 ? brandName.slice(0, hubIndex) : brandName;
  const brandAccent = hubIndex >= 0 ? brandName.slice(hubIndex) : "";

  /* =========================================================
     CLOSE USER DROPDOWN WHEN CLICKING OUTSIDE
  ========================================================= */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (cartRef.current && !cartRef.current.contains(event.target as Node)) {
        setCartOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  /* =========================================================
     CLOSE USER MENU WHEN LOGGED OUT
  ========================================================= */
  useEffect(() => {
    if (!user) {
      setUserMenuOpen(false);
    }
  }, [user]);

  /* =========================================================
     LOGOUT
  ========================================================= */
  const handleLogout = () => {
    setUserMenuOpen(false);
    setMobileOpen(false);
    onLogout();
  };

  /* =========================================================
     CLOSE MOBILE MENU AFTER NAVIGATION
  ========================================================= */
  const handleMobileNavigation = () => {
    setMobileOpen(false);
    setUserMenuOpen(false);
    setCartOpen(false);
  };

  return (
    <header
      className="
        relative
        z-50
        w-full
        border-t-2
        border-orange-500
        border-b
        border-slate-200
        bg-white
        text-slate-900
        dark:border-navy-600
        dark:bg-navy-900
        dark:text-white
      "
    >
      <nav
        className="
          mx-auto
          grid
          w-full
          max-w-[1440px]
          grid-cols-[auto_minmax(0,1fr)_auto]
          items-center
          gap-x-4
          px-4
          py-3
          sm:px-6
          lg:px-10
          xl:gap-x-6
        "
        aria-label="Main navigation"
      >
        {/* =====================================================
            BRAND
        ====================================================== */}
        <a
          href="/"
          aria-label={`${brandName} home`}
          className="
            min-w-0
            whitespace-nowrap
            text-[20px]
            font-bold
            tracking-tight
            text-[#11213a]
            dark:text-white
            sm:text-[24px]
          "
        >
          {brandPrefix}
          <span className="text-orange-500">{brandAccent}</span>
        </a>

        {/* =====================================================
            DESKTOP NAVIGATION
        ====================================================== */}
        <div
          className="
            hidden
            min-w-0
            items-center
            justify-center
            xl:flex
          "
        >
          <div
            className="
              flex
              max-w-full
              items-center
              gap-1
            "
          >
            {NAV_LINKS.map(({ label, href, icon: Icon }) => (
              <NavLink
                key={label}
                to={href}
                end={href === "/"}
                className={({ isActive }) => `
                  relative
                  flex
                  items-center
                  gap-1.5
                  whitespace-nowrap
                  rounded-lg
                  px-2
                  py-2.5
                  text-[14px]
                  font-medium
                  transition-colors
                  ${isActive ? "text-orange-500 dark:text-gold-400" : "text-[#172b4d] hover:text-orange-500 dark:text-slate-200 dark:hover:text-gold-400"}
                `}
              >
                {({ isActive }) => (
                  <>
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} aria-hidden="true" />

                    {label}

                    {isActive && (
                      <span
                        className="
                          absolute
                          bottom-0
                          left-2
                          right-2
                          h-0.5
                          rounded-full
                          bg-orange-500
                          dark:bg-gold-400
                        "
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>

        {/* =====================================================
            RIGHT SIDE
        ====================================================== */}
        <div
          className="
            flex
            min-w-0
            shrink-0
            items-center
            justify-end
            gap-2
            sm:gap-3
          "
        >
          {/* =================================================
              COUNTRY SELECTOR
          ================================================== */}
          <CountrySelector onNavigate={handleMobileNavigation} />

          {/* =================================================
              THEME
          ================================================== */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            className="
              hidden
              h-10
              w-10
              items-center
              justify-center
              rounded-full
              border
              border-slate-300
              bg-white
              text-[#172b4d]
              transition
              hover:border-orange-500
              hover:text-orange-500
              dark:border-navy-600
              dark:bg-navy-800
              dark:text-slate-200
              dark:hover:border-gold-400
              dark:hover:text-gold-400
              md:flex
            "
          >
            {theme === "dark" ? (
              <Sun className="h-[18px] w-[18px]" strokeWidth={1.7} />
            ) : (
              <Moon className="h-[18px] w-[18px]" strokeWidth={1.7} />
            )}
          </button>

          {/* =================================================
              SHOPPING CART
          ================================================== */}
          <div ref={cartRef} className="relative z-[100]">
            <button
              type="button"
              aria-label="Shopping cart"
              aria-expanded={cartOpen}
              onClick={() => setCartOpen((open) => !open)}
              className="
                relative
                flex
                h-10
                w-10
                shrink-0
                items-center
                justify-center
                border-0
                bg-transparent
                text-[#172b4d]
                transition
                hover:text-orange-500
                dark:text-slate-200
                dark:hover:text-gold-400
              "
            >
              <ShoppingCart className="h-[21px] w-[21px]" strokeWidth={1.7} />

              {cartCount > 0 && (
                <span
                  className="
                    absolute
                    right-0
                    top-[-2px]
                    flex
                    h-[20px]
                    min-w-[20px]
                    items-center
                    justify-center
                    rounded-full
                    bg-orange-500
                    px-1
                    text-[10px]
                    font-bold
                    leading-none
                    text-white
                  "
                >
                  {cartCount}
                </span>
              )}
            </button>

            {cartOpen && <CartDropdown />}
          </div>

          {/* =================================================
              AUTHENTICATED USER
          ================================================== */}
          {user ? (
            <div
              ref={userMenuRef}
              className="
                relative
                z-[100]
              "
            >
              {/* =================================================
                  USER BUTTON
              ================================================== */}
              <button
                type="button"
                onClick={() => setUserMenuOpen((open) => !open)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                aria-label={`Account menu for ${user.full_name}`}
                className="
                  flex
                  h-[54px]
                  max-w-[280px]
                  items-center
                  gap-2.5
                  rounded-[10px]
                  border
                  border-slate-200
                  bg-[#f8fbff]
                  px-3
                  transition-all
                  hover:border-orange-300
                  hover:bg-orange-50
                  dark:border-navy-600
                  dark:bg-navy-800
                  dark:hover:border-gold-400/40
                  dark:hover:bg-navy-700
                "
              >
                {/* Avatar */}
                <span
                  className="
                    flex
                    h-9
                    w-9
                    shrink-0
                    items-center
                    justify-center
                    rounded-full
                    bg-orange-500
                    text-sm
                    font-bold
                    text-white
                  "
                  aria-hidden="true"
                >
                  {user.full_name?.charAt(0).toUpperCase()}
                </span>

                {/* NAME */}
                <span
                  className="
                    hidden
                    min-w-0
                    max-w-[175px]
                    truncate
                    text-[14px]
                    font-semibold
                    text-[#172b4d]
                    dark:text-white
                    lg:inline
                  "
                >
                  {user.full_name}
                </span>

                {/* Chevron */}
                <ChevronDown
                  className={`
                    h-[17px]
                    w-[17px]
                    shrink-0
                    text-[#52627a]
                    dark:text-gray-400
                    transition-transform
                    duration-200
                    ${userMenuOpen ? "rotate-180" : ""}
                  `}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </button>

              {/* =================================================
                  USER DROPDOWN
              ================================================== */}
              {userMenuOpen && (
                <div
                  role="menu"
                  aria-label="Account menu"
                  className="
                    absolute
                    right-0
                    top-full
                    z-[99999]
                    mt-2
                    w-[250px]
                    overflow-hidden
                    rounded-xl
                    border
                    border-slate-200
                    bg-white
                    shadow-2xl
                    dark:border-navy-600
                    dark:bg-navy-800
                  "
                >
                  {/* User information */}
                  <div
                    className="
                      border-b
                      border-slate-100
                      px-4
                      py-3
                      dark:border-navy-600
                    "
                  >
                    <p className="text-xs text-slate-400 dark:text-gray-400">Signed in as</p>

                    <p
                      className="
                        mt-1
                        truncate
                        text-sm
                        font-semibold
                        text-[#172b4d]
                        dark:text-white
                      "
                    >
                      {user.full_name}
                    </p>
                  </div>

                  {/* Dashboard */}
                  <a
                    href={PUBLIC_DASHBOARD_PATH}
                    role="menuitem"
                    onClick={() => setUserMenuOpen(false)}
                    className="
                      flex
                      w-full
                      items-center
                      gap-3
                      px-4
                      py-3
                      text-sm
                      font-medium
                      text-[#172b4d]
                      transition
                      hover:bg-orange-50
                      hover:text-orange-500
                      dark:text-slate-200
                      dark:hover:bg-navy-700
                      dark:hover:text-gold-400
                    "
                  >
                    <LayoutDashboard
                      className="h-[18px] w-[18px]"
                      strokeWidth={1.7}
                      aria-hidden="true"
                    />

                    <span>Dashboard</span>
                  </a>

                  {/* Facility */}
                  {canAccessFacility(user) && (
                    <a
                      href={FACILITY_DASHBOARD_PATH}
                      role="menuitem"
                      onClick={() => setUserMenuOpen(false)}
                      className="
                        flex
                        w-full
                        items-center
                        gap-3
                        px-4
                        py-3
                        text-sm
                        font-medium
                        text-[#172b4d]
                        transition
                        hover:bg-orange-50
                        hover:text-orange-500
                        dark:text-slate-200
                        dark:hover:bg-navy-700
                        dark:hover:text-gold-400
                      "
                    >
                      <Building2
                        className="h-[18px] w-[18px]"
                        strokeWidth={1.7}
                        aria-hidden="true"
                      />

                      <span>Facility</span>
                    </a>
                  )}

                  {/* Training */}
                  {isTrainingProviderUser(user) && (
                    <a
                      href={TRAINING_DASHBOARD_PATH}
                      role="menuitem"
                      onClick={() => setUserMenuOpen(false)}
                      className="
                        flex
                        w-full
                        items-center
                        gap-3
                        px-4
                        py-3
                        text-sm
                        font-medium
                        text-[#172b4d]
                        transition
                        hover:bg-orange-50
                        hover:text-orange-500
                        dark:text-slate-200
                        dark:hover:bg-navy-700
                        dark:hover:text-gold-400
                      "
                    >
                      <GraduationCap
                        className="h-[18px] w-[18px]"
                        strokeWidth={1.7}
                        aria-hidden="true"
                      />

                      <span>Training</span>
                    </a>
                  )}

                  {/* My Store */}
                  {isSupplierUser(user) && (
                    <a
                      href={SUPPLIER_DASHBOARD_PATH}
                      role="menuitem"
                      onClick={() => setUserMenuOpen(false)}
                      className="
                        flex
                        w-full
                        items-center
                        gap-3
                        px-4
                        py-3
                        text-sm
                        font-medium
                        text-[#172b4d]
                        transition
                        hover:bg-orange-50
                        hover:text-orange-500
                        dark:text-slate-200
                        dark:hover:bg-navy-700
                        dark:hover:text-gold-400
                      "
                    >
                      <ShoppingBag
                        className="h-[18px] w-[18px]"
                        strokeWidth={1.7}
                        aria-hidden="true"
                      />

                      <span>My store</span>
                    </a>
                  )}

                  {/* Messages */}
                  {!isStaffUser(user) && (
                    <a
                      href="/messages"
                      role="menuitem"
                      onClick={() => setUserMenuOpen(false)}
                      className="
                        flex
                        w-full
                        items-center
                        gap-3
                        px-4
                        py-3
                        text-sm
                        font-medium
                        text-[#172b4d]
                        transition
                        hover:bg-orange-50
                        hover:text-orange-500
                        dark:text-slate-200
                        dark:hover:bg-navy-700
                        dark:hover:text-gold-400
                      "
                    >
                      <MessageCircle
                        className="h-[18px] w-[18px]"
                        strokeWidth={1.7}
                        aria-hidden="true"
                      />

                      <span>Messages</span>
                    </a>
                  )}

                  {/* Logout */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="
                      flex
                      w-full
                      items-center
                      gap-3
                      border-t
                      border-slate-100
                      px-4
                      py-3
                      text-left
                      text-sm
                      font-medium
                      text-red-500
                      transition
                      hover:bg-red-50
                    "
                  >
                    <LogOut className="h-[18px] w-[18px]" strokeWidth={1.7} aria-hidden="true" />

                    <span>Log out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* =================================================
               SIGN IN
            ================================================== */
            <button
              type="button"
              onClick={onSignIn}
              className="
                hidden
                items-center
                gap-1.5
                rounded-[9px]
                border
                border-orange-500
                bg-white
                px-4
                py-2
                text-[15px]
                font-semibold
                text-orange-500
                transition
                hover:bg-orange-500
                hover:text-white
                sm:inline-flex
              "
            >
              Sign in
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </button>
          )}

          {/* =================================================
              MOBILE MENU BUTTON
          ================================================== */}
          <button
            type="button"
            className="
              flex
              h-10
              w-10
              shrink-0
              items-center
              justify-center
              rounded-lg
              border-0
              bg-transparent
              text-slate-700
              transition
              hover:text-orange-500
              xl:hidden
            "
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

      {/* =======================================================
          MOBILE NAVIGATION
      ======================================================== */}
      {mobileOpen && (
        <div
          id="mobile-navigation"
          className="
            border-t
            border-slate-200
            bg-white
            px-5
            py-4
            dark:border-navy-600
            dark:bg-navy-900
            xl:hidden
          "
        >
          <div className="space-y-1">
            {/* Navigation links */}
            {NAV_LINKS.map(({ label, href, icon: Icon }) => (
              <NavLink
                key={label}
                to={href}
                end={href === "/"}
                onClick={handleMobileNavigation}
                className={({ isActive }) => `
                  flex
                  items-center
                  gap-3
                  rounded-lg
                  px-3
                  py-2.5
                  text-[15px]
                  font-medium
                  ${
                    isActive
                      ? "bg-orange-50 text-orange-500 dark:bg-navy-700 dark:text-gold-400"
                      : "text-slate-700 hover:bg-orange-50 hover:text-orange-500 dark:text-slate-200 dark:hover:bg-navy-700 dark:hover:text-gold-400"
                  }
                `}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} aria-hidden="true" />

                {label}
              </NavLink>
            ))}

            {/* =================================================
                MOBILE COUNTRY + THEME
            ================================================== */}
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-200 pt-3 dark:border-navy-600">
              <CountrySelector onNavigate={handleMobileNavigation} />
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                className="
                  flex
                  h-10
                  items-center
                  gap-2
                  rounded-full
                  border
                  border-slate-300
                  bg-white
                  px-4
                  text-sm
                  font-medium
                  text-[#172b4d]
                  transition
                  hover:border-orange-500
                  hover:text-orange-500
                  dark:border-navy-600
                  dark:bg-navy-800
                  dark:text-slate-200
                  dark:hover:border-gold-400
                  dark:hover:text-gold-400
                "
              >
                {theme === "dark" ? (
                  <Sun className="h-[18px] w-[18px]" strokeWidth={1.7} />
                ) : (
                  <Moon className="h-[18px] w-[18px]" strokeWidth={1.7} />
                )}
                {theme === "dark" ? "Light" : "Dark"}
              </button>
            </div>

            {/* =================================================
                MOBILE AUTHENTICATION
            ================================================== */}
            <div
              className="
                mt-3
                border-t
                border-slate-200
                pt-3
              "
            >
              {user ? (
                <div className="space-y-1">
                  {/* Mobile user */}
                  <div
                    className="
                      mb-2
                      flex
                      items-center
                      gap-3
                      rounded-[9px]
                      bg-[#f8fbff]
                      px-4
                      py-3
                      dark:bg-navy-800
                    "
                  >
                    <span
                      className="
                        flex
                        h-9
                        w-9
                        shrink-0
                        items-center
                        justify-center
                        rounded-full
                        bg-orange-500
                        text-sm
                        font-bold
                        text-white
                      "
                      aria-hidden="true"
                    >
                      {user.full_name?.charAt(0).toUpperCase()}
                    </span>

                    <div className="min-w-0">
                      <p className="text-xs text-slate-400 dark:text-gray-400">Signed in as</p>

                      <p
                        className="
                          truncate
                          text-sm
                          font-medium
                          text-[#172b4d]
                          dark:text-white
                        "
                      >
                        {user.full_name}
                      </p>
                    </div>
                  </div>

                  {/* Dashboard */}
                  <a
                    href={PUBLIC_DASHBOARD_PATH}
                    onClick={handleMobileNavigation}
                    className="
                      flex
                      w-full
                      items-center
                      gap-3
                      rounded-lg
                      px-4
                      py-3
                      text-sm
                      font-medium
                      text-[#172b4d]
                      transition
                      hover:bg-orange-50
                      hover:text-orange-500
                    "
                  >
                    <LayoutDashboard
                      className="h-[18px] w-[18px]"
                      strokeWidth={1.7}
                      aria-hidden="true"
                    />
                    Dashboard
                  </a>

                  {/* Facility */}
                  {canAccessFacility(user) && (
                    <a
                      href={FACILITY_DASHBOARD_PATH}
                      onClick={handleMobileNavigation}
                      className="
                        flex
                        w-full
                        items-center
                        gap-3
                        rounded-lg
                        px-4
                        py-3
                        text-sm
                        font-medium
                        text-[#172b4d]
                        transition
                        hover:bg-orange-50
                        hover:text-orange-500
                        dark:text-slate-200
                        dark:hover:bg-navy-700
                        dark:hover:text-gold-400
                      "
                    >
                      <Building2
                        className="h-[18px] w-[18px]"
                        strokeWidth={1.7}
                        aria-hidden="true"
                      />
                      Facility
                    </a>
                  )}

                  {/* Training */}
                  {isTrainingProviderUser(user) && (
                    <a
                      href={TRAINING_DASHBOARD_PATH}
                      onClick={handleMobileNavigation}
                      className="
                        flex
                        w-full
                        items-center
                        gap-3
                        rounded-lg
                        px-4
                        py-3
                        text-sm
                        font-medium
                        text-[#172b4d]
                        transition
                        hover:bg-orange-50
                        hover:text-orange-500
                        dark:text-slate-200
                        dark:hover:bg-navy-700
                        dark:hover:text-gold-400
                      "
                    >
                      <GraduationCap
                        className="h-[18px] w-[18px]"
                        strokeWidth={1.7}
                        aria-hidden="true"
                      />
                      Training
                    </a>
                  )}

                  {/* My Store */}
                  {isSupplierUser(user) && (
                    <a
                      href={SUPPLIER_DASHBOARD_PATH}
                      onClick={handleMobileNavigation}
                      className="
                        flex
                        w-full
                        items-center
                        gap-3
                        rounded-lg
                        px-4
                        py-3
                        text-sm
                        font-medium
                        text-[#172b4d]
                        transition
                        hover:bg-orange-50
                        hover:text-orange-500
                        dark:text-slate-200
                        dark:hover:bg-navy-700
                        dark:hover:text-gold-400
                      "
                    >
                      <ShoppingBag
                        className="h-[18px] w-[18px]"
                        strokeWidth={1.7}
                        aria-hidden="true"
                      />
                      My store
                    </a>
                  )}

                  {/* Messages */}
                  {!isStaffUser(user) && (
                    <a
                      href="/messages"
                      onClick={handleMobileNavigation}
                      className="
                        flex
                        w-full
                        items-center
                        gap-3
                        rounded-lg
                        px-4
                        py-3
                        text-sm
                        font-medium
                        text-[#172b4d]
                        transition
                        hover:bg-orange-50
                        hover:text-orange-500
                        dark:text-slate-200
                        dark:hover:bg-navy-700
                        dark:hover:text-gold-400
                      "
                    >
                      <MessageCircle
                        className="h-[18px] w-[18px]"
                        strokeWidth={1.7}
                        aria-hidden="true"
                      />
                      Messages
                    </a>
                  )}

                  {/* Logout */}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="
                      flex
                      w-full
                      items-center
                      gap-3
                      rounded-lg
                      px-4
                      py-3
                      text-left
                      text-sm
                      font-medium
                      text-red-500
                      transition
                      hover:bg-red-50
                    "
                  >
                    <LogOut className="h-[18px] w-[18px]" strokeWidth={1.7} aria-hidden="true" />
                    Log out
                  </button>
                </div>
              ) : (
                /* Mobile sign in */
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    onSignIn();
                  }}
                  className="
                    flex
                    w-full
                    items-center
                    justify-center
                    gap-2
                    rounded-[9px]
                    border
                    border-orange-500
                    bg-white
                    px-4
                    py-2.5
                    text-[15px]
                    font-semibold
                    text-orange-500
                    transition
                    hover:bg-orange-500
                    hover:text-white
                  "
                >
                  Sign in
                  <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
