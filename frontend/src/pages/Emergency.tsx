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
    <div className="bg-slate-50 dark:bg-navy-950">
      <div className="bg-red-600 px-4 py-3 text-center text-sm font-semibold text-white">
        Dental emergency? Contact a local emergency service or call a dental provider directly.
      </div>

      <section className="relative overflow-hidden border-b border-slate-200 py-12 dark:border-navy-600 sm:py-16">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(239,68,68,0.14),transparent_58%)]"
          aria-hidden="true"
        />
        <div className="app-container relative text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
            <AlertTriangle className="h-8 w-8" aria-hidden="true" />
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-red-600 dark:text-red-400">
            Urgent dental support
          </p>
          <h1 className="mx-auto mt-3 max-w-3xl font-display text-4xl font-bold text-slate-950 sm:text-5xl dark:text-white">
            Find emergency dental care now
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-600 dark:text-gray-300">
            Review providers marked open in the directory and call ahead to confirm that they can
            accept an urgent appointment.
          </p>
        </div>
      </section>

      <div className="app-container py-10 sm:py-12">
        <section
          className="rounded-3xl border border-red-200 bg-white p-6 shadow-[0_18px_50px_rgba(239,68,68,0.08)] sm:p-8 dark:border-red-500/30 dark:bg-navy-800"
          aria-labelledby="urgent-guidance-heading"
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
              <ShieldAlert className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="urgent-guidance-heading"
                className="font-heading text-xl font-semibold text-slate-950 dark:text-white"
              >
                If your symptoms feel urgent
              </h2>
              <p className="mt-3 max-w-4xl leading-7 text-slate-700 dark:text-gray-300">
                If you have severe or worsening pain, facial swelling, bleeding that will not stop,
                a knocked-out adult tooth, fever, or difficulty breathing or swallowing, contact
                your local emergency service now. Do not delay emergency care to use this directory.
              </p>
              <p className="mt-3 text-sm font-medium text-slate-600 dark:text-gray-400">
                DentHub does not diagnose symptoms or assess urgency. A dental professional must
                assess you.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-10" aria-labelledby="open-listings-heading">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600 dark:text-gold-300">
                Directory snapshot
              </p>
              <h2
                id="open-listings-heading"
                className="mt-2 font-heading text-2xl font-semibold text-slate-950 dark:text-white"
              >
                Open dental listings
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-gray-300">
                {`${openListings.length} ${openListings.length === 1 ? "listing" : "listings"} marked open now`}
              </p>
            </div>
            <p className="max-w-md text-sm leading-6 text-slate-500 dark:text-gray-400">
              Open status comes from each listing's published opening hours. Call first to confirm
              urgent capacity.
            </p>
          </div>

          {error && hasData && (
            <div
              role="alert"
              className="mt-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between dark:border-gold-400/30 dark:bg-gold-400/10 dark:text-gold-300"
            >
              <p>Could not refresh the directory — showing the last loaded listings.</p>
              <button
                type="button"
                onClick={() => void refetch()}
                className="min-h-11 shrink-0 rounded-lg border border-amber-300 px-4 font-heading text-sm font-semibold transition hover:border-amber-400 dark:border-gold-400/40"
              >
                Try again
              </button>
            </div>
          )}

          {!hasData && isLoading ? (
            <output className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-navy-600 dark:bg-navy-800">
              <p className="font-heading text-lg font-semibold text-slate-900 dark:text-white">
                Loading open listings…
              </p>
            </output>
          ) : !hasData && error ? (
            <div
              role="alert"
              className="mt-6 rounded-2xl border border-red-200 bg-white p-8 text-center dark:border-red-500/30 dark:bg-navy-800"
            >
              <TriangleAlert
                className="mx-auto h-8 w-8 text-red-600 dark:text-red-400"
                aria-hidden="true"
              />
              <h3 className="mt-4 font-heading text-lg font-semibold text-slate-900 dark:text-white">
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
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-navy-500 dark:bg-navy-800">
              <PhoneCall
                className="mx-auto h-8 w-8 text-orange-500 dark:text-gold-400"
                aria-hidden="true"
              />
              <h3 className="mt-4 font-heading text-lg font-semibold text-slate-900 dark:text-white">
                No open listings are available
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-gray-300">
                Contact your local emergency service if your symptoms feel urgent.
              </p>
            </div>
          )}
        </section>

        <section
          className="mt-10 flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center sm:p-8 dark:border-navy-600 dark:bg-navy-800"
          aria-labelledby="international-emergency-heading"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 dark:bg-navy-700 dark:text-gold-300">
            <Globe2 className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h2
              id="international-emergency-heading"
              className="font-heading text-xl font-semibold text-slate-950 dark:text-white"
            >
              International visitor?
            </h2>
            <p className="mt-2 leading-7 text-slate-600 dark:text-gray-300">
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
