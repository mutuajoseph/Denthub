import {
  AlertTriangle,
  ArrowRight,
  Globe2,
  PhoneCall,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import { useMemo } from "react";
import { DentistListingCard } from "../components/dentists/DentistListingCard";
import Button from "../components/ui/Button";
import { useCountryConfig } from "../hooks/useCountryConfig";
import { useListingSearch } from "../hooks/useListingSearch";
import { searchListings } from "../lib/listingSearch";

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong loading the directory.";
}

export function Emergency() {
  const { apiCountry } = useCountryConfig();
  const { listings, isLoading, error, refetch } = useListingSearch({
    country: apiCountry,
    listingType: "all",
  });

  const openListings = useMemo(
    () => searchListings({ openNow: true, sort: "name_asc" }, listings),
    [listings],
  );

  const hasData = listings.length > 0;

  return (
    <div className="bg-paper">
      <div className="bg-red-600 px-4 py-3 text-center text-sm font-semibold text-white">
        Dental emergency? Contact a local emergency service or call a dental provider directly.
      </div>

      <section className="border-b border-steel py-12 sm:py-16">
        <div className="app-container text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-card bg-red-50 text-red-600">
            <AlertTriangle className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 className="mx-auto mt-5 max-w-3xl font-display text-4xl font-medium tracking-[-0.04em] text-ink sm:text-5xl">
            Find emergency dental care now
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate">
            Review providers marked open in the directory and call ahead to confirm that they can
            accept an urgent appointment.
          </p>
        </div>
      </section>

      <div className="app-container py-10 sm:py-12">
        <section
          className="rounded-card border border-red-200 bg-paper p-6 shadow-card-white sm:p-8"
          aria-labelledby="urgent-guidance-heading"
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-red-50 text-red-600">
              <ShieldAlert className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="urgent-guidance-heading"
                className="font-heading text-xl font-semibold text-ink"
              >
                If your symptoms feel urgent
              </h2>
              <p className="mt-3 max-w-4xl leading-7 text-charcoal">
                If you have severe or worsening pain, facial swelling, bleeding that will not stop,
                a knocked-out adult tooth, fever, or difficulty breathing or swallowing, contact
                your local emergency service now. Do not delay emergency care to use this directory.
              </p>
              <p className="mt-3 text-sm font-medium text-slate">
                DentHub does not diagnose symptoms or assess urgency. A dental professional must
                assess you.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-10" aria-labelledby="open-listings-heading">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2
                id="open-listings-heading"
                className="font-heading text-2xl font-semibold text-ink"
              >
                Open dental listings
              </h2>
              <p className="mt-2 text-sm text-slate">
                {`${openListings.length} ${openListings.length === 1 ? "listing" : "listings"} marked open now`}
              </p>
            </div>
            <p className="max-w-md text-sm leading-6 text-slate">
              Open status comes from each listing's published opening hours. Call first to confirm
              urgent capacity.
            </p>
          </div>

          {error && hasData && (
            <div
              role="alert"
              className="mt-6 flex flex-col gap-3 rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between"
            >
              <p>Could not refresh the directory — showing the last loaded listings.</p>
              <button
                type="button"
                onClick={() => void refetch()}
                className="min-h-11 shrink-0 rounded-button border border-amber-300 px-4 font-heading text-sm font-semibold transition hover:border-amber-400"
              >
                Try again
              </button>
            </div>
          )}

          {!hasData && isLoading ? (
            <output className="mt-6 block rounded-card border border-steel bg-paper p-8 text-center">
              <p className="font-heading text-lg font-semibold text-ink">Loading open listings…</p>
            </output>
          ) : !hasData && error ? (
            <div
              role="alert"
              className="mt-6 rounded-card border border-red-200 bg-paper p-8 text-center"
            >
              <TriangleAlert className="mx-auto h-8 w-8 text-red-600" aria-hidden="true" />
              <h3 className="mt-4 font-heading text-lg font-semibold text-ink">
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
          ) : openListings.length > 0 ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {openListings.map((listing) => (
                <DentistListingCard
                  key={listing.id}
                  listing={listing}
                  variant="compact"
                  showPhone
                />
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-card border border-dashed border-steel bg-paper p-8 text-center">
              <PhoneCall className="mx-auto h-8 w-8 text-charcoal" aria-hidden="true" />
              <h3 className="mt-4 font-heading text-lg font-semibold text-ink">
                No open listings are available
              </h3>
              <p className="mt-2 text-sm text-slate">
                Contact your local emergency service if your symptoms feel urgent.
              </p>
            </div>
          )}
        </section>

        <section
          className="mt-10 flex flex-col gap-5 rounded-card border border-steel bg-paper p-6 sm:flex-row sm:items-center sm:p-8"
          aria-labelledby="international-emergency-heading"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-cloud text-charcoal">
            <Globe2 className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h2
              id="international-emergency-heading"
              className="font-heading text-xl font-semibold text-ink"
            >
              International visitor?
            </h2>
            <p className="mt-2 leading-7 text-charcoal">
              Tell the provider about your travel constraints and language needs. International
              planning does not replace urgent or emergency assessment.
            </p>
          </div>
          <Button to="/international" variant="secondary" icon={ArrowRight}>
            International guidance
          </Button>
        </section>
      </div>
    </div>
  );
}
