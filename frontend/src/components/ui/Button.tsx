import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../utils/cn";

const variants = {
  primary:
    "bg-orange-500 hover:bg-orange-600 text-white shadow-[0_10px_25px_rgba(255,138,31,0.25)]",
  secondary:
    "border-2 border-orange-500 text-orange-500 hover:bg-orange-50 hover:text-orange-600 dark:border-gold-400 dark:text-gold-300 dark:hover:bg-gold-400/10 dark:hover:text-gold-300",
  ghost:
    "text-slate-700 hover:text-orange-500 hover:bg-orange-50 dark:text-gray-300 dark:hover:text-gold-400 dark:hover:bg-navy-700/50",
  danger: "bg-red-600 hover:bg-red-700 text-white",
} as const;

const sizes = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-base",
} as const;

type Variant = keyof typeof variants;
type Size = keyof typeof sizes;

interface ButtonProps extends Omit<ComponentProps<"button">, "ref"> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  to?: string;
  children: ReactNode;
}

export default function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  icon: Icon,
  to,
  ...props
}: ButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-heading font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400",
    variants[variant],
    sizes[size],
    className,
  );

  const content = (
    <>
      {Icon && <Icon className="w-4 h-4" aria-hidden="true" />}
      {children}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} {...props}>
      {content}
    </button>
  );
}
