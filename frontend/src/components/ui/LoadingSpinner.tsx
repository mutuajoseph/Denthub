import { cn } from "../../utils/cn";

type Size = "sm" | "md" | "lg";

interface LoadingSpinnerProps {
  size?: Size;
  className?: string;
}

const sizes: Record<Size, string> = {
  sm: "h-5 w-5",
  md: "h-8 w-8",
  lg: "h-12 w-12",
};

export default function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-2 border-navy-600 border-t-gold-400",
        sizes[size],
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}
