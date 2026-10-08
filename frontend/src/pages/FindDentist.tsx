import { LayoutGrid, List, SearchX, ShieldCheck, Stethoscope, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { DentistListingCard } from "../components/dentists/DentistListingCard";
import {
  DEFAULT_DENTIST_FILTERS,
  type DentistFilterState,
  DentistSearchFilters,
} from "../components/dentists/DentistSearchFilters";
import { useCountryConfig } from "../hooks/useCountryConfig";
import { useListingSearch } from "../hooks/useListingSearch";
import { useSpecialties } from "../hooks/useSpecialties";
import { searchListings } from "../lib/listingSearch";
import { useRegionStore } from "../store/regionStore";

function countActiveFilters(filters: DentistFilterState): number {
  return [
    filters.query.trim(),
    filters.subdivision,
    filters.listingType === "all" ? "" : filters.listingType,
    filters.specialty,
    filters.minRating > 0 ? filters.minRating : "",
    filters.openNow,
  ].filter(Boolean).length;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong loading the directory.";
}

export function FindDentist() {
  const { apiCountry, regions } = useCountryConfig();
  const { options: specialtyOptions } = useSpecialties();
  const setRegion = useRegionStore((s) => s.setRegion);
  const [filters, setFilters] = useState<DentistFilterState>({ ...DEFAULT_DENTIST_FILTERS });
  const [view, setView] = useState<"grid" | "list">("grid");

  const { listings, isLoading, error, refetch } = useListingSearch({
    country: apiCountry,
    subdivisionCode: filters.subdivision || undefined,
    listingType: filters.listingType,
  });

  const results = useMemo(() => searchListings(filters, listings), [filters, listings]);
  const activeFilterCount = countActiveFilters(filters);

  function handleCountryChange(country: string): void {
    setRegion(country);
  }

  function clearFilters(): void {
    setFilters({ ...DEFAULT_DENTIST_FILTERS });
  }

  return (
    <div className="bg-slate-50 dark:bg-navy-950">
      <section className="hero-bg border-b border-slate-200 py-12 dark:border-navy-600 sm:py-16">
        <div className="app-container">
          <div className="max-w-3xl">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-orange-600 dark:text-gold-300">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Verified directory
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold text-slate-950 sm:text-5xl dark:text-white">
              Find the right dental care
            </h1>
            <p className="mt-4 text-lg text-slate-600 dark:text-gray-300">
              Search specialist physicians and dental practices across countries, regions,
              specialties, and availability.
            </p>
          </div>
        </div>
      </section>

      <section
        className="app-container py-8 sm:py-10 lg:py-12"
        aria-labelledby="search-results-heading"
      >
        <h2 id="search-results-heading" className="sr-only">
          Dental provider search results
        </h2>

        <div className="grid items-start gap-6 lg:grid-cols-[18.5rem_minmax(0,1fr)] xl:gap-8">
          <DentistSearchFilters
            value={filters}
            country={apiCountry}
            subdivisions={regions}
            specialtyOptions={specialtyOptions}
            activeFilterCount={activeFilterCount}
            onCountryChange={handleCountryChange}
            onChange={setFilters}
            onClear={clearFilters}
          />

          <div className="min-w-0">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between dark:border-navy-600">
              <div aria-live="polite">
                <p className="font-heading text-2xl font-semibold text-slate-900 dark:text-white">
                  {isLoading && listings.length === 0
                    ? "Loading results…"
                    : `${results.length} ${results.length === 1 ? "result" : "results"}`}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
                  {results.length > 0
                    ? "Compare specialties, fees, and opening status."
                    : "Adjust your search to see available providers."}
                </p>
              </div>

              <fieldset className="inline-flex w-fit rounded-xl border border-slate-200 bg-white p-1 dark:border-navy-600 dark:bg-navy-800">
                <legend className="sr-only">Result layout</legend>
                <button
                  type="button"
                  aria-label="Grid view"
                  aria-pressed={view === "grid"}
                  onClick={() => setView("grid")}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
                    view === "grid"
                      ? "bg-orange-500 text-white"
                      : "text-slate-600 hover:bg-orange-50 dark:text-gray-300 dark:hover:bg-navy-700"
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                  Grid
                </button>
                <button
                  type="button"
                  aria-label="List view"
                  aria-pressed={view === "list"}
                  onClick={() => setView("list")}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
                    view === "list"
                      ? "bg-orange-500 text-white"
                      : "text-slate-600 hover:bg-orange-50 dark:text-gray-300 dark:hover:bg-navy-700"
                  }`}
                >
                  <List className="h-4 w-4" aria-hidden="true" />
                  List
                </button>
              </fieldset>
            </div>

            {isLoading && listings.length === 0 ? (
              <output className="mt-6 rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center dark:border-navy-600 dark:bg-navy-800">
                <p className="font-heading text-lg font-semibold text-slate-900 dark:text-white">
                  Loading dental providers…
                </p>
                <p className="mt-2 text-sm text-slate-500 dark:text-gray-400">
                  Fetching listings for your selection from the directory.
                </p>
              </output>
            ) : error && listings.length === 0 ? (
              <div
                role="alert"
                className="mt-6 rounded-2xl border border-red-200 bg-white px-6 py-14 text-center dark:border-red-500/30 dark:bg-navy-800"
              >
                <TriangleAlert
                  className="mx-auto h-10 w-10 text-red-600 dark:text-red-400"
                  aria-hidden="true"
                />
                <h3 className="mt-4 font-heading text-xl font-semibold text-slate-900 dark:text-white">
                  Directory unavailable
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-gray-300">
                  {describeError(error)}
                </p>
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 font-heading text-sm font-semibold text-white transition hover:bg-orange-600"
                >
                  Try again
                </button>
              </div>
            ) : results.length > 0 ? (
              <>
                {error && (
                  <div
                    role="alert"
                    className="mt-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between dark:border-gold-400/30 dark:bg-gold-400/10 dark:text-gold-300"
                  >
                    <p>Could not refresh results — showing the last loaded listings.</p>
                    <button
                      type="button"
                      onClick={() => void refetch()}
                      className="min-h-11 shrink-0 rounded-lg border border-amber-300 px-4 font-heading text-sm font-semibold transition hover:border-amber-400 dark:border-gold-400/40"
                    >
                      Try again
                    </button>
                  </div>
                )}

                <div
                  className={
                    view === "grid"
                      ? "mt-6 grid gap-5 sm:grid-cols-2 2xl:grid-cols-3"
                      : "mt-6 grid gap-4"
                  }
                >
                  {results.map((listing) => (
                    <DentistListingCard key={listing.id} listing={listing} variant={view} />
                  ))}
                </div>
              </>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center dark:border-navy-500 dark:bg-navy-800">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 dark:bg-navy-700 dark:text-gold-300">
                  <SearchX className="h-7 w-7" aria-hidden="true" />
                </div>
                <h3 className="mt-5 font-heading text-xl font-semibold text-slate-900 dark:text-white">
                  No dental providers match
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-gray-300">
                  Try a broader location, remove a specialty filter, or include closed providers by
                  turning off Open now.
                </p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 font-heading text-sm font-semibold text-white transition hover:bg-orange-600"
                >
                  <Stethoscope className="h-4 w-4" aria-hidden="true" />
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
