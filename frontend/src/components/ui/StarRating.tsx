import { Star } from "lucide-react";
import { cn } from "../../utils/cn";

type Size = "sm" | "md" | "lg";

interface StarRatingProps {
  rating: number;
  size?: Size;
  showValue?: boolean;
  /** `inverse` for Graphite and Ink surfaces. */
  tone?: "default" | "inverse";
}

const sizes: Record<Size, string> = { sm: "h-3.5 w-3.5", md: "h-4 w-4", lg: "h-5 w-5" };

const tones = {
  default: { on: "fill-ink text-ink", off: "fill-steel text-steel", value: "text-ink" },
  inverse: { on: "fill-paper text-paper", off: "fill-white/20 text-white/20", value: "text-paper" },
} as const;

export default function StarRating({
  rating,
  size = "sm",
  showValue = true,
  tone = "default",
}: StarRatingProps) {
  const colours = tones[tone];

  return (
    <div className="flex items-center gap-0.5" role="img" aria-label={`Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden="true"
          className={cn(sizes[size], star <= Math.round(rating) ? colours.on : colours.off)}
        />
      ))}
      {showValue && (
        <span
          className={cn("tabular ml-1.5 text-sm font-medium", colours.value)}
          aria-hidden="true"
        >
          {rating}
        </span>
      )}
    </div>
  );
}
