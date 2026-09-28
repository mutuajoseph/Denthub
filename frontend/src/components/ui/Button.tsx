import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../utils/cn";

/*
 * Variants follow docs/design/DESIGN.md:
 * - primary: Aqua Conversion Button. The one conversion action per view.
 * - secondary: paper button with a steel hairline, paired with primary.
 * - graphite: Graphite Header Button, the compact high-emphasis control.
 * - translucent: secondary action on Ink or Graphite surfaces.
 */
const variants = {
  primary: "bg-aqua-relay text-ink hover:bg-aqua-relay-deep",
  secondary: "bg-paper text-ink ring-1 ring-inset ring-steel hover:bg-cloud hover:ring-slate",
  graphite: "bg-graphite text-paper shadow-edge hover:bg-ink",
  translucent: "bg-white/10 text-paper shadow-edge hover:bg-white/15",
  ghost: "text-charcoal hover:bg-cloud hover:text-ink",
  danger: "bg-red-700 text-paper hover:bg-red-800",
} as const;

const sizes = {
  sm: "min-h-9 rounded-button px-3 py-1.5",
  md: "min-h-10 rounded-button px-4 py-2",
  lg: "min-h-12 rounded-card py-3 pl-[22px] pr-4",
} as const;

type Variant = keyof typeof variants;
type Size = keyof typeof sizes;

interface ButtonProps extends Omit<ComponentProps<"button">, "ref"> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  /** Directional icon after the label (8px gap), e.g. an arrow on a conversion button. */
  trailingIcon?: LucideIcon;
  to?: string;
  children: ReactNode;
}

export default function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  icon: Icon,
  trailingIcon: TrailingIcon,
  to,
  ...props
}: ButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center gap-2 font-body text-sm font-medium leading-none tracking-[-0.01em] whitespace-nowrap",
    "transition-[background-color,box-shadow,color] duration-200 ease-out",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
    variants[variant],
    sizes[size],
    className,
  );

  const content = (
    <>
      {Icon && <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />}
      {children}
      {TrailingIcon && (
        <TrailingIcon className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
      )}
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
