import { ALL_CATEGORIES, getCategoryMeta } from "../../config/productConstants";
import { cn } from "../../utils/cn";

interface CategoryFilterProps {
  /** Category ids to offer, "All" first (see `buildCategoryOptions`). */
  categories: string[];
  active: string;
  onChange: (category: string) => void;
  isLoading?: boolean;
}

/**
 * Horizontal category scroller.
 *
 * Rendered as a single-select group: the buttons carry `aria-pressed` so the
 * active one is announced, which the source version omitted. The selected item
 * is marked with the aqua signal (DESIGN.md "Use-Case Filter Row").
 */
export default function CategoryFilter({
  categories,
  active,
  onChange,
  isLoading = false,
}: CategoryFilterProps) {
  if (isLoading) {
    return (
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2" aria-hidden="true" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-9 w-24 shrink-0 animate-pulse rounded-button bg-cloud" />
        ))}
      </div>
    );
  }

  return (
    <fieldset className="mb-6 flex gap-2 overflow-x-auto pb-2">
      <legend className="sr-only">Filter products by category</legend>
      {categories.map((category) => {
        const isAll = category === ALL_CATEGORIES;
        const { label, icon: Icon } = getCategoryMeta(category);
        const isActive = category === active;

        return (
          <button
            key={category}
            type="button"
            onClick={() => onChange(category)}
            aria-pressed={isActive}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-button px-4 py-2 text-sm font-medium transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
              isActive ? "bg-aqua-relay text-ink" : "text-slate hover:bg-cloud hover:text-ink",
            )}
          >
            {!isAll && <Icon className="h-4 w-4" aria-hidden="true" />}
            {isAll ? "All" : label}
          </button>
        );
      })}
    </fieldset>
  );
}
