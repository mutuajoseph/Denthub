import { Search, SlidersHorizontal } from "lucide-react";
import { useId } from "react";
import { REGIONS } from "../../config/regions";
import type { CountryCode, DentistListingType } from "../../lib/dentistFixtures";
import type { DentistSearchSort } from "../../lib/dentistSearch";

export type DentistListingTypeFilter = DentistListingType | "all";

export interface DentistFilterState {
  query: string;
  country: CountryCode | "";
  subdivision: string;
  listingType: DentistListingTypeFilter;
  specialty: string;
  insurance: string;
  minRating: number;
  openNow: boolean;
  sort: DentistSearchSort;
}

export const DEFAULT_DENTIST_FILTERS: DentistFilterState = {
  query: "",
  country: "",
  subdivision: "",
  listingType: "all",
  specialty: "",
  insurance: "",
  minRating: 0,
  openNow: false,
  sort: "rating_desc",
};

export interface DentistSearchFiltersProps {
  value: DentistFilterState;
  countries: readonly { code: CountryCode; name: string }[];
  subdivisions: readonly string[];
  specialties: readonly string[];
  insuranceOptions: readonly string[];
  activeFilterCount: number;
  onChange: (next: DentistFilterState) => void;
  onClear: () => void;
}

const controlClass =
  "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-navy-600 dark:bg-navy-900 dark:text-white";

export function DentistSearchFilters({
  value,
  countries,
  subdivisions,
  specialties,
  insuranceOptions,
  activeFilterCount,
  onChange,
  onClear,
}: DentistSearchFiltersProps) {
  const searchId = useId();
  const countryId = useId();
  const subdivisionId = useId();
  const listingTypeId = useId();
  const specialtyId = useId();
  const insuranceId = useId();
  const ratingId = useId();
  const sortId = useId();
  const subdivisionHint = value.country
    ? REGIONS[value.country].countiesLabel
    : "region or subdivision";

  function update<Key extends keyof DentistFilterState>(
    key: Key,
    nextValue: DentistFilterState[Key],
  ): void {
    onChange({ ...value, [key]: nextValue });
  }

  return (
    <aside
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.06)] dark:border-navy-600 dark:bg-navy-800 lg:sticky lg:top-24"
      aria-labelledby={`${searchId}-heading`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-navy-600">
        <h2
          id={`${searchId}-heading`}
          className="flex items-center gap-2 font-heading text-base font-semibold text-slate-900 dark:text-white"
        >
          <SlidersHorizontal
            className="h-4 w-4 text-orange-500 dark:text-gold-400"
            aria-hidden="true"
          />
          Refine results
        </h2>
        {activeFilterCount > 0 && (
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700 dark:bg-gold-400/10 dark:text-gold-300">
            {activeFilterCount} active
          </span>
        )}
      </div>

      <div className="mt-5 space-y-5">
        <div>
          <label
            htmlFor={searchId}
            className="text-sm font-medium text-slate-700 dark:text-gray-300"
          >
            Search dentists and practices
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
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
          <label
            htmlFor={countryId}
            className="text-sm font-medium text-slate-700 dark:text-gray-300"
          >
            Country
          </label>
          <select
            id={countryId}
            value={value.country}
            onChange={(event) => {
              const country = event.currentTarget.value as CountryCode | "";
              onChange({ ...value, country, subdivision: "" });
            }}
            className={controlClass}
          >
            <option value="">All countries</option>
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor={subdivisionId}
            className="text-sm font-medium text-slate-700 dark:text-gray-300"
          >
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
              <option key={subdivision} value={subdivision}>
                {subdivision}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor={listingTypeId}
            className="text-sm font-medium text-slate-700 dark:text-gray-300"
          >
            Listing type
          </label>
          <select
            id={listingTypeId}
            value={value.listingType}
            onChange={(event) =>
              update("listingType", event.currentTarget.value as DentistListingTypeFilter)
            }
            className={controlClass}
          >
            <option value="all">All listing types</option>
            <option value="specialist">Specialist physicians</option>
            <option value="practice">Dental practices</option>
          </select>
        </div>

        <div>
          <label
            htmlFor={specialtyId}
            className="text-sm font-medium text-slate-700 dark:text-gray-300"
          >
            Specialty or procedure
          </label>
          <select
            id={specialtyId}
            value={value.specialty}
            onChange={(event) => update("specialty", event.currentTarget.value)}
            className={controlClass}
          >
            <option value="">Any specialty</option>
            {specialties.map((specialty) => (
              <option key={specialty} value={specialty}>
                {specialty}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor={insuranceId}
            className="text-sm font-medium text-slate-700 dark:text-gray-300"
          >
            Insurance
          </label>
          <select
            id={insuranceId}
            value={value.insurance}
            onChange={(event) => update("insurance", event.currentTarget.value)}
            className={controlClass}
          >
            <option value="">Any insurance</option>
            {insuranceOptions.map((insurance) => (
              <option key={insurance} value={insurance}>
                {insurance}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor={ratingId}
              className="text-sm font-medium text-slate-700 dark:text-gray-300"
            >
              Minimum rating
            </label>
            <output
              htmlFor={ratingId}
              className="text-xs font-semibold text-orange-600 dark:text-gold-300"
            >
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
            className="mt-3 w-full accent-orange-500 dark:accent-gold-400"
          />
          <div className="mt-1 flex justify-between text-[11px] text-slate-400 dark:text-gray-400">
            <span>Any</span>
            <span>5.0</span>
          </div>
        </div>

        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-orange-300 dark:border-navy-600 dark:text-gray-300 dark:hover:border-gold-400/40">
          <span>Open now</span>
          <input
            type="checkbox"
            checked={value.openNow}
            onChange={(event) => update("openNow", event.currentTarget.checked)}
            className="h-4 w-4 rounded border-slate-300 text-orange-500 accent-orange-500 focus:ring-orange-500 dark:border-navy-500 dark:bg-navy-900"
          />
        </label>

        <div>
          <label htmlFor={sortId} className="text-sm font-medium text-slate-700 dark:text-gray-300">
            Sort results
          </label>
          <select
            id={sortId}
            value={value.sort}
            onChange={(event) => update("sort", event.currentTarget.value as DentistSearchSort)}
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
          className="min-h-11 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-orange-400 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-navy-500 dark:text-gray-300 dark:hover:border-gold-400 dark:hover:text-gold-300"
        >
          Clear filters
        </button>
      </div>
    </aside>
  );
}
