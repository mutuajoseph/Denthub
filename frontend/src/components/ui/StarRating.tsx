import { Star } from "lucide-react";
import { cn } from "../../utils/cn";

type Size = "sm" | "md" | "lg";

interface StarRatingProps {
  rating: number;
  size?: Size;
  showValue?: boolean;
}

export default function StarRating({ rating, size = "sm", showValue = true }: StarRatingProps) {
  const sizes: Record<Size, string> = { sm: "w-3.5 h-3.5", md: "w-4 h-4", lg: "w-5 h-5" };

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            sizes[size],
            star <= Math.round(rating)
              ? "fill-gold-400 text-gold-400"
              : "fill-navy-600 text-navy-600",
          )}
        />
      ))}
      {showValue && <span className="ml-1 text-sm text-gold-400 font-medium">{rating}</span>}
    </div>
  );
}
