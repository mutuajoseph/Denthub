import { useState } from "react";

import { getCategoryMeta } from "../../config/productConstants";
import { cn } from "../../utils/cn";

/**
 * Deterministic gradient per category, so a product always looks the same
 * across renders and machines.
 *
 * The source app interpolated `product.gradient`, a field no API response ever
 * populated, so every card rendered the literal class `undefined` and fell back
 * to the browser default. Category is a value the API does return, so deriving
 * from it is both stable and actually populated.
 */
const CATEGORY_GRADIENTS: Record<string, string> = {
  brushing: "from-sky-500 to-blue-700",
  toothpaste: "from-teal-500 to-emerald-700",
  floss: "from-cyan-500 to-sky-700",
  mouthwash: "from-sky-400 to-cyan-700",
  whitening: "from-amber-400 to-orange-600",
  children: "from-rose-400 to-pink-600",
  specialty: "from-violet-500 to-purple-800",
};

const DEFAULT_GRADIENT = "from-slate-500 to-slate-800";

function gradientFor(category: string): string {
  return CATEGORY_GRADIENTS[category] ?? DEFAULT_GRADIENT;
}

interface ProductImageProps {
  src: string | null;
  alt: string;
  category: string;
  className?: string;
}

/**
 * Product artwork with a guaranteed placeholder.
 *
 * Falls back to the category tile when the product has no image, and again if
 * a URL fails to load, so a broken asset never leaves a blank card.
 */
export default function ProductImage({ src, alt, category, className }: ProductImageProps) {
  // Tracks *which* URL failed rather than a bare boolean, so a new `src`
  // automatically gets a fresh attempt without a reset effect.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const showImage = Boolean(src) && failedSrc !== src;

  if (showImage) {
    return (
      <img
        src={src ?? ""}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setFailedSrc(src)}
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }

  const { icon: Icon } = getCategoryMeta(category);

  return (
    <div
      // Decorative: the product name is always rendered as text next to this.
      role="img"
      aria-label={src ? `No image available for ${alt}` : undefined}
      className={cn(
        "flex h-full w-full items-center justify-center bg-gradient-to-br",
        gradientFor(category),
        className,
      )}
    >
      <Icon className="h-10 w-10 text-white/70" aria-hidden="true" />
    </div>
  );
}

/** Small square thumbnail used by cart lines. */
export function ProductThumbnail(props: Omit<ProductImageProps, "className">) {
  return (
    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg">
      <ProductImage {...props} />
    </div>
  );
}
