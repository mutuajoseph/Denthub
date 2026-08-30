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
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { AuthUser } from "../lib/auth";

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

/* =========================================================
   ROLE HELPERS
========================================================= */

function normalizeRole(role: string | undefined) {
  return role?.trim().toLowerCase();
}

function isSupplierUser(user: AuthUser | null) {
  return normalizeRole(user?.role) === "supplier";
}

function isTrainingProviderUser(user: AuthUser | null) {
  const role = normalizeRole(user?.role);

  return role === "training_provider" || role === "training provider" || role === "trainer";
}

function canAccessFacility(user: AuthUser | null) {
  const role = normalizeRole(user?.role);

  return role === "facility" || role === "facility_admin" || role === "facility admin";
}

function isStaffUser(user: AuthUser | null) {
  const role = normalizeRole(user?.role);

  return role === "staff" || role === "admin";
}

/* =========================================================
   NAVBAR
========================================================= */

export default function Navbar({ onSignIn, user, onLogout }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);

  /* =========================================================
     CLOSE USER DROPDOWN WHEN CLICKING OUTSIDE
  ========================================================= */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
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
          aria-label="DentHub Kenya home"
          className="
            min-w-0
            whitespace-nowrap
            text-[20px]
            font-bold
            tracking-tight
            text-[#11213a]
            sm:text-[24px]
          "
        >
          Dent
          <span className="text-orange-500">Hub Kenya</span>
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
            {NAV_LINKS.map(({ label, href, icon: Icon }) => {
              const isHome = href === "/";

              return (
                <a
                  key={label}
                  href={href}
                  className={`
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
                    ${isHome ? "text-orange-500" : "text-[#172b4d] hover:text-orange-500"}
                  `}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} aria-hidden="true" />

                  {label}

                  {isHome && (
                    <span
                      className="
                        absolute
                        bottom-0
                        left-2
                        right-2
                        h-0.5
                        rounded-full
                        bg-orange-500
                      "
                    />
                  )}
                </a>
              );
            })}
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
              THEME
          ================================================== */}
          <button
            type="button"
            aria-label="Theme"
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
              md:flex
            "
          >
            <Moon className="h-[18px] w-[18px]" strokeWidth={1.7} />
          </button>

          {/* =================================================
              SHOPPING CART
          ================================================== */}
          <button
            type="button"
            aria-label="Shopping cart"
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
            "
          >
            <ShoppingCart className="h-[21px] w-[21px]" strokeWidth={1.7} />

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
              2
            </span>
          </button>

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
                  "
                >
                  {/* User information */}
                  <div
                    className="
                      border-b
                      border-slate-100
                      px-4
                      py-3
                    "
                  >
                    <p className="text-xs text-slate-400">Signed in as</p>

                    <p
                      className="
                        mt-1
                        truncate
                        text-sm
                        font-semibold
                        text-[#172b4d]
                      "
                    >
                      {user.full_name}
                    </p>
                  </div>

                  {/* Dashboard */}
                  <a
                    href="/dashboard"
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
                      href="/dashboard/facility"
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
                      href="/dashboard/training"
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
                      href="/dashboard/supplier"
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
            xl:hidden
          "
        >
          <div className="space-y-1">
            {/* Navigation links */}
            {NAV_LINKS.map(({ label, href, icon: Icon }) => {
              const isHome = href === "/";

              return (
                <a
                  key={label}
                  href={href}
                  onClick={handleMobileNavigation}
                  className={`
                    flex
                    items-center
                    gap-3
                    rounded-lg
                    px-3
                    py-2.5
                    text-[15px]
                    font-medium
                    ${
                      isHome
                        ? "bg-orange-50 text-orange-500"
                        : "text-slate-700 hover:bg-orange-50 hover:text-orange-500"
                    }
                  `}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} aria-hidden="true" />

                  {label}
                </a>
              );
            })}

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
                      <p className="text-xs text-slate-400">Signed in as</p>

                      <p
                        className="
                          truncate
                          text-sm
                          font-medium
                          text-[#172b4d]
                        "
                      >
                        {user.full_name}
                      </p>
                    </div>
                  </div>

                  {/* Dashboard */}
                  <a
                    href="/dashboard"
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
                      href="/dashboard/facility"
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
                      href="/dashboard/training"
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
                      href="/dashboard/supplier"
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
