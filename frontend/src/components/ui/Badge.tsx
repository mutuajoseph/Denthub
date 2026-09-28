import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

type Variant = "gold" | "orange" | "green" | "red" | "navy";

interface BadgeProps {
  children: ReactNode;
  variant?: Variant;
  className?: string;
}

/*
 * Status chips are the one place the pill shape stays (DESIGN.md keeps 1000px
 * radii off controls and cards). Variant names are the historical ones:
 * gold = emphasis (ink), orange = featured (graphite), navy = neutral.
 */
const variants: Record<Variant, string> = {
  gold: "bg-ink text-paper ring-ink",
  orange: "bg-graphite text-paper ring-graphite",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  red: "bg-red-50 text-red-800 ring-red-200",
  navy: "bg-cloud text-charcoal ring-steel",
};

export default function Badge({ children, variant = "gold", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium leading-none ring-1 ring-inset",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
