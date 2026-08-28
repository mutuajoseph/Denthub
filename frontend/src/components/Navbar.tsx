import { useState } from "react";
import {
  Menu,
  X,
  Home,
  BookOpen,
  Stethoscope,
  ShoppingBag,
  Briefcase,
  GraduationCap,
  Newspaper,
  Moon,
  ShoppingCart,
  ArrowRight,
} from "lucide-react";

type NavbarProps = {
  onSignIn: () => void;
};

const NAV_LINKS = [
  { label: "Home", icon: Home },
  { label: "About", icon: BookOpen },
  { label: "Find a Dentist", icon: Stethoscope },
  { label: "Oral Care Shop", icon: ShoppingBag },
  { label: "Jobs", icon: Briefcase },
  { label: "Training", icon: GraduationCap },
  { label: "Magazine", icon: Newspaper },
];

export default function Navbar({ onSignIn }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header
      className="
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
          gap-x-10
          px-8
          py-4
          lg:px-10
        "
        aria-label="Main navigation"
      >
        {/* Brand */}
        <a
          href="#"
          className="
            whitespace-nowrap
            text-[24px]
            font-bold
            tracking-tight
            text-[#11213a]
          "
        >
          Dent
          <span className="text-orange-500">Hub Kenya</span>
        </a>

        {/* Desktop Navigation */}
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
              gap-3
            "
          >
            {NAV_LINKS.map(({ label, icon: Icon }, index) => (
              <a
                key={label}
                href="#"
                className={`
                  relative
                  flex
                  items-center
                  gap-1.5
                  whitespace-nowrap
                  rounded-lg
                  px-2.5
                  py-2.5
                  text-[15px]
                  font-medium
                  transition-colors
                  ${
                    index === 0
                      ? "text-orange-500"
                      : "text-[#172b4d] hover:text-orange-500"
                  }
                `}
              >
                <Icon
                  className="h-[18px] w-[18px]"
                  strokeWidth={1.7}
                  aria-hidden="true"
                />

                {label}

                {/* Active underline */}
                {index === 0 && (
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
            ))}
          </div>
        </div>

        {/* Right Side */}
        <div
          className="
            flex
            shrink-0
            items-center
            justify-end
            gap-3
          "
        >
          {/* Theme Icon */}
          <button
            type="button"
            aria-label="Theme"
            className="
              flex
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
            "
          >
            <Moon
              className="h-[18px] w-[18px]"
              strokeWidth={1.7}
            />
          </button>

          {/* Cart */}
          <button
            type="button"
            aria-label="Shopping cart"
            className="
              relative
              flex
              h-10
              w-10
              items-center
              justify-center
              border-0
              bg-transparent
              text-[#172b4d]
              transition
              hover:text-orange-500
            "
          >
            <ShoppingCart
              className="h-[20px] w-[20px]"
              strokeWidth={1.7}
            />

            {/* Cart Count */}
            <span
              className="
                absolute
                right-[-2px]
                top-[-3px]
                flex
                h-5
                min-w-5
                items-center
                justify-center
                rounded-full
                bg-orange-500
                px-1
                text-[10px]
                font-semibold
                text-white
              "
            >
              2
            </span>
          </button>

          {/* Sign In */}
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
              md:inline-flex
            "
          >
            Sign in

            <ArrowRight
              className="h-4 w-4"
              strokeWidth={1.8}
            />
          </button>

          {/* Mobile Menu Button */}
          <button
            type="button"
            className="
              flex
              h-10
              w-10
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
            aria-label="Menu"
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile Navigation */}
      {mobileOpen && (
        <div
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
            {NAV_LINKS.map(({ label, icon: Icon }, index) => (
              <a
                key={label}
                href="#"
                onClick={() => setMobileOpen(false)}
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
                    index === 0
                      ? "bg-orange-50 text-orange-500"
                      : "text-slate-700 hover:bg-orange-50 hover:text-orange-500"
                  }
                `}
              >
                <Icon
                  className="h-[18px] w-[18px]"
                  strokeWidth={1.7}
                  aria-hidden="true"
                />

                {label}
              </a>
            ))}

            {/* Mobile Sign In */}
            <div
              className="
                mt-3
                border-t
                border-slate-200
                pt-3
              "
            >
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

                <ArrowRight
                  className="h-4 w-4"
                  strokeWidth={1.8}
                />
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
