import { LayoutGrid, List, SearchX, Stethoscope, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { DentistListingCard } from "../components/dentists/DentistListingCard";
import {
  DEFAULT_DENTIST_FILTERS,
  type DentistFilterState,
  DentistSearchFilters,
} from "../components/dentists/DentistSearchFilters";
import { useCountries } from "../hooks/useCountries";
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
  const { countries } = useCountries();
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
    <div className="bg-paper">
      <section className="border-b border-steel py-12 sm:py-16">
        <div className="app-container">
          <div className="max-w-3xl">
            <h1 className="font-display text-4xl font-medium tracking-[-0.04em] text-ink sm:text-5xl">
              Find the right dental care
            </h1>
            <p className="mt-4 text-lg text-slate">
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
            countries={countries}
            subdivisions={regions}
            specialtyOptions={specialtyOptions}
            activeFilterCount={activeFilterCount}
            onCountryChange={handleCountryChange}
            onChange={setFilters}
            onClear={clearFilters}
          />

          <div className="min-w-0">
            <div className="flex flex-col gap-4 border-b border-steel pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div aria-live="polite">
                <p className="font-heading text-2xl font-semibold text-ink">
                  {isLoading && listings.length === 0
                    ? "Loading results…"
                    : `${results.length} ${results.length === 1 ? "result" : "results"}`}
                </p>
                <p className="mt-1 text-sm text-slate">
                  {results.length > 0
                    ? "Compare specialties, fees, and opening status."
                    : "Adjust your search to see available providers."}
                </p>
              </div>

              <fieldset className="inline-flex w-fit rounded-button border border-steel bg-paper p-1">
                <legend className="sr-only">Result layout</legend>
                <button
                  type="button"
                  aria-label="Grid view"
                  aria-pressed={view === "grid"}
                  onClick={() => setView("grid")}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-button px-3 text-sm font-semibold transition ${
                    view === "grid" ? "bg-ink text-paper" : "text-slate hover:bg-cloud"
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
                  className={`inline-flex min-h-11 items-center gap-2 rounded-button px-3 text-sm font-semibold transition ${
                    view === "list" ? "bg-ink text-paper" : "text-slate hover:bg-cloud"
                  }`}
                >
                  <List className="h-4 w-4" aria-hidden="true" />
                  List
                </button>
              </fieldset>
            </div>

            {isLoading && listings.length === 0 ? (
              <output className="mt-6 block rounded-card border border-steel bg-paper px-6 py-14 text-center">
                <p className="font-heading text-lg font-semibold text-ink">
                  Loading dental providers…
                </p>
                <p className="mt-2 text-sm text-slate">
                  Fetching listings for your selection from the directory.
                </p>
              </output>
            ) : error && listings.length === 0 ? (
              <div
                role="alert"
                className="mt-6 rounded-card border border-red-200 bg-paper px-6 py-14 text-center"
              >
                <TriangleAlert className="mx-auto h-10 w-10 text-red-600" aria-hidden="true" />
                <h3 className="mt-4 font-heading text-xl font-semibold text-ink">
                  Directory unavailable
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate">{describeError(error)}</p>
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-button bg-ink px-5 py-2.5 font-heading text-sm font-semibold text-paper transition hover:bg-graphite"
                >
                  Try again
                </button>
              </div>
            ) : results.length > 0 ? (
              <>
                {error && (
                  <div
                    role="alert"
                    className="mt-6 flex flex-col gap-3 rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <p>Could not refresh results — showing the last loaded listings.</p>
                    <button
                      type="button"
                      onClick={() => void refetch()}
                      className="min-h-11 shrink-0 rounded-button border border-amber-300 px-4 font-heading text-sm font-semibold transition hover:border-amber-400"
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
              <div className="mt-6 rounded-card border border-dashed border-steel bg-paper px-6 py-14 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-card bg-cloud text-charcoal">
                  <SearchX className="h-7 w-7" aria-hidden="true" />
                </div>
                <h3 className="mt-5 font-heading text-xl font-semibold text-ink">
                  No dental providers match
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate">
                  Try a broader location, remove a specialty filter, or include closed providers by
                  turning off Open now.
                </p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-button bg-ink px-5 py-2.5 font-heading text-sm font-semibold text-paper transition hover:bg-graphite"
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
