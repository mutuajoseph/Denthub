import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

type Variant = "gold" | "orange" | "green" | "red" | "navy";

interface BadgeProps {
  children: ReactNode;
  variant?: Variant;
  className?: string;
}

const variants: Record<Variant, string> = {
  gold: "bg-gold-400/15 text-gold-300 border-gold-400/30",
  orange: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  green: "bg-green-500/15 text-green-400 border-green-500/30",
  red: "bg-red-500/15 text-red-400 border-red-500/30",
  navy: "bg-navy-700 text-gray-300 border-navy-600",
};

export default function Badge({ children, variant = "gold", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium font-mono",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
