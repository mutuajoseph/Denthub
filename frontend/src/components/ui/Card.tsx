import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../utils/cn";

/*
 * Surfaces from docs/design/DESIGN.md: a white technical card on the paper
 * canvas, a Cloud product card, and a Graphite card for dark proof blocks.
 */
const tones = {
  white: "bg-paper text-ink ring-1 ring-inset ring-black/[0.08] shadow-card-white",
  cloud: "bg-cloud text-ink shadow-card-cloud",
  graphite: "bg-graphite text-paper shadow-card-graphite",
} as const;

interface CardProps extends ComponentProps<"div"> {
  children: ReactNode;
  tone?: keyof typeof tones;
  hover?: boolean;
}

export default function Card({
  children,
  className,
  tone = "white",
  hover = true,
  ...props
}: CardProps) {
  return (
    <div
      className={cn("rounded-card p-4", tones[tone], hover && "card-hover", className)}
      {...props}
    >
      {children}
    </div>
  );
}
