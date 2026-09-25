import { AlertTriangle, ArrowRight, Globe2, PhoneCall, ShieldAlert } from "lucide-react";
import { DentistListingCard } from "../components/dentists/DentistListingCard";
import Button from "../components/ui/Button";
import { listDentistFixtures } from "../lib/dentistFixtures";

const OPEN_LISTINGS = listDentistFixtures()
  .filter((listing) => listing.hours.openNow)
  .slice()
  .sort((left, right) => {
    if (left.name < right.name) return -1;
    if (left.name > right.name) return 1;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });

export function Emergency() {
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
                {`${OPEN_LISTINGS.length} fixture listings marked open now`}
              </p>
            </div>
            <p className="max-w-md text-sm leading-6 text-slate-500 dark:text-gray-400">
              Open status comes from the frontend fixture dataset, not a live availability feed.
              Call first to confirm urgent capacity.
            </p>
          </div>

          {OPEN_LISTINGS.length > 0 ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {OPEN_LISTINGS.map((listing) => (
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
