import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

/*
 * Status chips are the one place the pill shape stays (DESIGN.md keeps 1000px
 * radii off controls and cards).
 */
const tones = {
  ink: "bg-ink text-paper ring-ink",
  graphite: "bg-graphite text-paper ring-graphite",
  neutral: "bg-cloud text-charcoal ring-steel",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  danger: "bg-red-50 text-red-800 ring-red-200",
};

const variants = {
  ...tones,
  // Old palette names, still used by screens not yet revamped (#11).
  gold: tones.ink,
  orange: tones.graphite,
  navy: tones.neutral,
  green: tones.success,
  red: tones.danger,
};

type Variant = keyof typeof variants;

interface BadgeProps {
  children: ReactNode;
  variant?: Variant;
  className?: string;
}

export default function Badge({ children, variant = "ink", className }: BadgeProps) {
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
