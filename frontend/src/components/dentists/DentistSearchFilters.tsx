import { Search, SlidersHorizontal } from "lucide-react";
import { useId } from "react";
import type { CountrySummaryWire } from "../../lib/countryConfigApi";
import type { Subdivision } from "../../lib/countryConfigApi";
import type { ListingSort, ListingTypeFilter } from "../../lib/listingSearch";

export interface DentistFilterState {
  query: string;
  /** Subdivision code within the active market; a request input, not text. */
  subdivision: string;
  listingType: ListingTypeFilter;
  /** A specialty **code**; `""` is any. */
  specialty: string;
  minRating: number;
  openNow: boolean;
  sort: ListingSort;
}

export const DEFAULT_DENTIST_FILTERS: DentistFilterState = {
  query: "",
  subdivision: "",
  listingType: "all",
  specialty: "",
  minRating: 0,
  openNow: false,
  sort: "rating_desc",
};

export interface DentistSearchFiltersProps {
  value: DentistFilterState;
  /** The active market. The country combo switches the region itself (#18). */
  country: string;
  /** Every active country, for the country combo. */
  countries: readonly CountrySummaryWire[];
  subdivisions: readonly Subdivision[];
  specialtyOptions: readonly { code: string; name: string }[];
  activeFilterCount: number;
  onCountryChange: (country: string) => void;
  onChange: (next: DentistFilterState) => void;
  onClear: () => void;
}

const controlClass =
  "mt-1.5 w-full rounded-button border border-steel bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/20";
const labelClass = "text-sm font-medium text-charcoal";

export function DentistSearchFilters({
  value,
  country,
  countries,
  subdivisions,
  specialtyOptions,
  activeFilterCount,
  onCountryChange,
  onChange,
  onClear,
}: DentistSearchFiltersProps) {
  const searchId = useId();
  const countryId = useId();
  const subdivisionId = useId();
  const listingTypeId = useId();
  const specialtyId = useId();
  const ratingId = useId();
  const sortId = useId();
  const subdivisionHint =
    countries.find((option) => option.code === country)?.subdivision_label ?? "region";

  function update<Key extends keyof DentistFilterState>(
    key: Key,
    nextValue: DentistFilterState[Key],
  ): void {
    onChange({ ...value, [key]: nextValue });
  }

  return (
    <aside
      className="rounded-card border border-steel bg-paper p-5 shadow-card-white lg:sticky lg:top-24"
      aria-labelledby={`${searchId}-heading`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-steel pb-4">
        <h2
          id={`${searchId}-heading`}
          className="flex items-center gap-2 font-heading text-base font-semibold text-ink"
        >
          <SlidersHorizontal className="h-4 w-4 text-charcoal" aria-hidden="true" />
          Refine results
        </h2>
        {activeFilterCount > 0 && (
          <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-semibold text-paper">
            {activeFilterCount} active
          </span>
        )}
      </div>

      <div className="mt-5 space-y-5">
        <div>
          <label htmlFor={searchId} className={labelClass}>
            Search dentists and practices
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate"
              aria-hidden="true"
            />
            <input
              id={searchId}
              type="search"
              value={value.query}
              onChange={(event) => update("query", event.currentTarget.value)}
              placeholder="Name, clinic, specialty…"
              className={`${controlClass} pl-9`}
            />
          </div>
        </div>

        <div>
          <label htmlFor={countryId} className={labelClass}>
            Country
          </label>
          <select
            id={countryId}
            value={country}
            onChange={(event) => {
              // One source of truth: the combo switches the region, which
              // drives Accept-Country, the currency, and this page's request.
              onCountryChange(event.currentTarget.value);
              onChange({ ...value, subdivision: "" });
            }}
            className={controlClass}
          >
            {countries.map((option) => (
              <option key={option.code} value={option.code}>
                {option.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={subdivisionId} className={labelClass}>
            Region or subdivision
          </label>
          <select
            id={subdivisionId}
            value={value.subdivision}
            onChange={(event) => update("subdivision", event.currentTarget.value)}
            className={controlClass}
          >
            <option value="">All {subdivisionHint}s</option>
            {subdivisions.map((subdivision) => (
              <option key={subdivision.code} value={subdivision.code}>
                {subdivision.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={listingTypeId} className={labelClass}>
            Listing type
          </label>
          <select
            id={listingTypeId}
            value={value.listingType}
            onChange={(event) =>
              update("listingType", event.currentTarget.value as ListingTypeFilter)
            }
            className={controlClass}
          >
            <option value="all">All listing types</option>
            <option value="specialist">Dental specialists</option>
            <option value="facility">Dental practices</option>
          </select>
        </div>

        <div>
          <label htmlFor={specialtyId} className={labelClass}>
            Specialty or procedure
          </label>
          <select
            id={specialtyId}
            value={value.specialty}
            onChange={(event) => update("specialty", event.currentTarget.value)}
            className={controlClass}
          >
            <option value="">Any specialty</option>
            {specialtyOptions.map((specialty) => (
              <option key={specialty.code} value={specialty.code}>
                {specialty.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor={ratingId} className={labelClass}>
              Minimum rating
            </label>
            <output htmlFor={ratingId} className="text-xs font-semibold text-charcoal">
              {value.minRating === 0 ? "Any" : `${value.minRating.toFixed(1)}+`}
            </output>
          </div>
          <input
            id={ratingId}
            type="range"
            min="0"
            max="5"
            step="0.5"
            value={value.minRating}
            onChange={(event) => update("minRating", Number(event.currentTarget.value))}
            className="mt-3 w-full accent-ink"
          />
          <div className="mt-1 flex justify-between text-[11px] text-slate">
            <span>Any</span>
            <span>5.0</span>
          </div>
        </div>

        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-button border border-steel px-3.5 py-2.5 text-sm font-medium text-charcoal transition hover:border-ink">
          <span>Open now</span>
          <input
            type="checkbox"
            checked={value.openNow}
            onChange={(event) => update("openNow", event.currentTarget.checked)}
            className="h-4 w-4 rounded border-steel text-ink accent-ink focus:ring-ink"
          />
        </label>

        <div>
          <label htmlFor={sortId} className={labelClass}>
            Sort results
          </label>
          <select
            id={sortId}
            value={value.sort}
            onChange={(event) => update("sort", event.currentTarget.value as ListingSort)}
            className={controlClass}
          >
            <option value="rating_desc">Highest rated</option>
            <option value="reviews_desc">Most reviewed</option>
            <option value="name_asc">Name (A-Z)</option>
            <option value="name_desc">Name (Z-A)</option>
          </select>
        </div>

        <button
          type="button"
          onClick={onClear}
          disabled={activeFilterCount === 0}
          className="min-h-11 w-full rounded-button border border-steel px-4 py-2.5 text-sm font-semibold text-charcoal transition hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          Clear filters
        </button>
      </div>
    </aside>
  );
}
