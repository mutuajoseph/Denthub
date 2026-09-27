/**
 * Shop category metadata.
 *
 * The source app kept two copies of the category list (`productConstants.js`
 * and an inline array in `CategoryFilter`) and they drifted. Here the *set* of
 * categories comes from the API (`GET /products/categories`, i.e. what is
 * actually stocked in the active country) and this file only supplies the
 * presentational metadata for ids we recognise. An unknown id still renders —
 * it just falls back to a title-cased label and a generic icon.
 */

import type { LucideIcon } from "lucide-react";
import { Baby, Droplet, HelpCircle, Scissors, Smile, Sparkles, Star } from "lucide-react";

/** Sentinel used by the filter to mean "no category filter". */
export const ALL_CATEGORIES = "all";

export interface CategoryMeta {
  label: string;
  icon: LucideIcon;
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  brushing: { label: "Brushing", icon: Smile },
  toothpaste: { label: "Toothpaste", icon: Sparkles },
  floss: { label: "Floss", icon: Scissors },
  mouthwash: { label: "Mouthwash", icon: Droplet },
  whitening: { label: "Whitening", icon: Sparkles },
  children: { label: "Children", icon: Baby },
  specialty: { label: "Specialty", icon: Star },
};

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function getCategoryMeta(category: string): CategoryMeta {
  return (
    CATEGORY_META[category] ?? {
      label: titleCase(category),
      icon: HelpCircle,
    }
  );
}

/** Category ids to offer, always leading with "All". */
export function buildCategoryOptions(stockedCategories: string[]): string[] {
  const known = Object.keys(CATEGORY_META).filter((id) => stockedCategories.includes(id));
  const extra = stockedCategories.filter((id) => !CATEGORY_META[id]).sort();

  return [ALL_CATEGORIES, ...known, ...extra];
}

export const FREE_DELIVERY_THRESHOLD = 3000;
