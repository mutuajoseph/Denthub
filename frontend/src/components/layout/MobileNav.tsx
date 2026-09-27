import type { LucideIcon } from "lucide-react";
import { BookOpen, Briefcase, GraduationCap, Home, ShoppingBag, Stethoscope } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "../../utils/cn";

type MobileNavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
};

const mobileNavItems: MobileNavItem[] = [
  { label: "Home", to: "/", icon: Home },
  { label: "About", to: "/about", icon: BookOpen },
  { label: "Dentists", to: "/dentists", icon: Stethoscope },
  { label: "Shop", to: "/shop", icon: ShoppingBag },
  { label: "Jobs", to: "/jobs", icon: Briefcase },
  { label: "Training", to: "/training", icon: GraduationCap },
];

export function MobileNav() {
  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-navy-600 bg-navy-900/95 pb-safe-bottom backdrop-blur-md md:hidden"
    >
      <ul className="flex min-h-[4.25rem] items-stretch justify-around px-1 py-1">
        {mobileNavItems.map(({ label, to, icon: Icon }) => (
          <li key={to} className="flex min-w-0 flex-1 justify-center">
            <NavLink
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex min-h-[3.5rem] w-full max-w-[5.5rem] flex-col items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-[10px] font-semibold transition-colors",
                  isActive
                    ? "bg-navy-800 text-gold-400"
                    : "text-slate-300 hover:bg-navy-800 hover:text-gold-300",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className="w-full truncate text-center">{label}</span>
                  {isActive && <span className="sr-only">(current page)</span>}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
