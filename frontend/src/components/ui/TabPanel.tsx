import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

interface TabPanelProps {
  active: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Keeps children mounted but hidden, so switching tabs never remounts a subtree
 * or refetches what it already has.
 */
export default function TabPanel({ active, children, className }: TabPanelProps) {
  return (
    <div className={cn(!active && "hidden", className)} aria-hidden={!active} inert={!active}>
      {children}
    </div>
  );
}
