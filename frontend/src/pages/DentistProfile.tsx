import {
  ArrowLeft,
  Award,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  Phone,
  ShieldCheck,
  Stethoscope,
  TriangleAlert,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { AppointmentRequestPreview } from "../components/dentists/AppointmentRequestPreview";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import StarRating from "../components/ui/StarRating";
import { useCountryConfig } from "../hooks/useCountryConfig";
import { useListingDetail } from "../hooks/useListingDetail";
import type { ListingType } from "../lib/listingApi";
import { formatListingPrice } from "../utils/formatCurrency";
import { summarizeHours } from "../utils/hours";
import { subdivisionLabel } from "../utils/subdivisionLabel";

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong loading this profile.";
}

export function DentistProfile() {
  const params = useParams();
  // Typed route carries both segments; the legacy routes carry only `id`.
  const rawType = params.listingType;
  const listingType: ListingType | null =
    rawType === "facility" || rawType === "specialist" ? rawType : null;
  const id = params.id ?? "";
  const providerName = id || "this provider";

  const { regions } = useCountryConfig();
  const { profile, isLoading, error, refetch } = useListingDetail(listingType, id);

  if (isLoading) {
    return (
      <div className="hero-bg flex min-h-[70vh] items-center justify-center px-4 py-16">
        <output className="rounded-3xl border border-slate-200 bg-white/95 px-10 py-8 text-center shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur dark:border-navy-600 dark:bg-navy-800/95">
          <p className="font-heading text-lg font-semibold text-slate-900 dark:text-white">
            Loading profile…
          </p>
        </output>
      </div>
    );
  }

  if (error) {
    return (
      <div className="hero-bg flex min-h-[70vh] items-center justify-center px-4 py-16">
        <div className="w-full max-w-xl rounded-3xl border border-red-200 bg-white/95 p-8 text-center shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur dark:border-red-500/30 dark:bg-navy-800/95 sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
            <TriangleAlert className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold text-slate-950 dark:text-white">
            Could not load this profile
          </h1>
          <p className="mt-3 text-slate-600 dark:text-gray-300">{describeError(error)}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button onClick={() => void refetch()} icon={CalendarDays}>
              Try again
            </Button>
            <Button to="/find-dentist" variant="secondary" icon={ArrowLeft}>
              Back to dentist search
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="hero-bg flex min-h-[70vh] items-center justify-center px-4 py-16">
        <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white/95 p-8 text-center shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur dark:border-navy-600 dark:bg-navy-800/95 sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 dark:bg-navy-700 dark:text-gold-300">
            <Stethoscope className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold text-slate-950 dark:text-white">
            Dental provider not found
          </h1>
          <p className="mt-3 text-slate-600 dark:text-gray-300">
            We could not find “{providerName}”. It may have moved or the link may be incomplete.
          </p>
          <Button className="mt-7" to="/find-dentist" icon={ArrowLeft}>
            Back to dentist search
          </Button>
        </div>
      </div>
    );
  }

  const listing = profile.listing;
  const typeLabel = listing.listingType === "specialist" ? "Dental specialist" : "Dental practice";
  const ListingIcon = listing.listingType === "specialist" ? Stethoscope : Building2;
  const showVerifiedBadge =
    listing.listingType === "facility" &&
    (listing.verificationTier === "verified" || listing.verificationTier === "featured");
  const showFeaturedNote =
    listing.listingType === "facility" && listing.verificationTier === "featured";
  const price = formatListingPrice(listing.amount, listing.currency);
  const subdivisionName =
    regions.find((row) => row.code === listing.subdivisionCode)?.name ??
    subdivisionLabel(listing.subdivisionCode);

  return (
    <div className="bg-slate-50 py-8 dark:bg-navy-950 sm:py-10 lg:py-12">
      <div className="app-container max-w-6xl">
        <Link
          to="/find-dentist"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-orange-600 hover:text-orange-700 dark:text-gold-300 dark:hover:text-gold-400"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to dentist search
        </Link>

        <article className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)] dark:border-navy-600 dark:bg-navy-800">
          <div className="relative overflow-hidden bg-gradient-to-br from-orange-50 via-white to-amber-50 px-6 py-10 dark:from-navy-700 dark:via-navy-800 dark:to-navy-700 sm:px-10 sm:py-12">
            <div
              className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-gold-400/10"
              aria-hidden="true"
            />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-white text-orange-600 shadow-lg dark:bg-navy-900 dark:text-gold-300">
                <ListingIcon className="h-10 w-10" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600 dark:text-gold-300">
                    {typeLabel}
                  </p>
                  {showVerifiedBadge && (
                    <Badge variant="green" className="gap-1">
                      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                      Verified listing
                    </Badge>
                  )}
                </div>
                <h1 className="mt-2 font-display text-3xl font-bold text-slate-950 sm:text-4xl dark:text-white">
                  {listing.name}
                </h1>
                {listing.clinic && (
                  <p className="mt-2 text-lg text-slate-600 dark:text-gray-300">{listing.clinic}</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)] lg:p-10">
            <div>
              <div className="flex flex-wrap items-center gap-4">
                {listing.rating !== null && <StarRating rating={listing.rating} size="lg" />}
                <span className="text-sm text-slate-500 dark:text-gray-400">
                  {listing.rating !== null
                    ? `${listing.rating} from ${listing.reviewCount} reviews`
                    : listing.reviewCount > 0
                      ? `${listing.reviewCount} reviews`
                      : "No reviews yet"}
                </span>
              </div>

              {listing.specialties.length > 0 && (
                <section className="mt-8" aria-labelledby="specialties-heading">
                  <h2
                    id="specialties-heading"
                    className="font-heading text-lg font-semibold text-slate-900 dark:text-white"
                  >
                    Specialties and services
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {listing.specialties.map((specialty) => (
                      <Badge key={specialty}>{specialty}</Badge>
                    ))}
                  </div>
                </section>
              )}

              <section className="mt-8" aria-labelledby="details-heading">
                <h2
                  id="details-heading"
                  className="font-heading text-lg font-semibold text-slate-900 dark:text-white"
                >
                  Location and availability
                </h2>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="flex gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-navy-900">
                    <MapPin
                      className="mt-0.5 h-5 w-5 shrink-0 text-orange-500 dark:text-gold-400"
                      aria-hidden="true"
                    />
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Location
                      </dt>
                      <dd className="mt-1 text-sm text-slate-700 dark:text-gray-300">
                        {profile.address && (
                          <p>
                            {profile.address}
                            <br />
                          </p>
                        )}
                        {subdivisionName} · {listing.countryCode}
                        {!profile.address && profile.branches.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {profile.branches.map((branch) => (
                              <li key={branch.id}>
                                {branch.facilityName}
                                {branch.name ? ` — ${branch.name}` : ""}: {branch.address}
                              </li>
                            ))}
                          </ul>
                        )}
                      </dd>
                    </div>
                  </div>
                  <div className="flex gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-navy-900">
                    <Clock3
                      className="mt-0.5 h-5 w-5 shrink-0 text-orange-500 dark:text-gold-400"
                      aria-hidden="true"
                    />
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Hours
                      </dt>
                      <dd className="mt-1 text-sm text-slate-700 dark:text-gray-300">
                        <ul className="space-y-1.5">
                          {profile.branches.map((branch) => {
                            const label =
                              listing.listingType === "specialist"
                                ? branch.facilityName
                                : branch.name;
                            return (
                              <li key={branch.id}>
                                {profile.branches.length > 1 && label && (
                                  <span className="font-medium">{label} — </span>
                                )}
                                {summarizeHours(branch.hours) || "Hours not published"}
                              </li>
                            );
                          })}
                        </ul>
                      </dd>
                    </div>
                  </div>
                  <div className="flex gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-navy-900">
                    <CalendarDays
                      className="mt-0.5 h-5 w-5 shrink-0 text-orange-500 dark:text-gold-400"
                      aria-hidden="true"
                    />
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Status
                      </dt>
                      <dd className="mt-1 text-sm text-slate-700 dark:text-gray-300">
                        {listing.openNow ? "Open now" : "Closed"}
                      </dd>
                    </div>
                  </div>
                </dl>
              </section>

              <div className="mt-8 flex gap-3 rounded-2xl border border-slate-200 p-4 text-sm leading-6 text-slate-600 dark:border-navy-600 dark:text-gray-300">
                <CheckCircle2
                  className="mt-1 h-5 w-5 shrink-0 text-green-600 dark:text-green-400"
                  aria-hidden="true"
                />
                <p>
                  Confirm appointment availability, insurance acceptance, and final fees directly
                  with the provider before making travel or treatment decisions.
                </p>
              </div>
            </div>

            <aside
              className="space-y-5 lg:sticky lg:top-24 lg:self-start"
              aria-label="Contact and fees"
            >
              {price && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-navy-600 dark:bg-navy-900">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Consultation from
                  </p>
                  <p className="mt-1 font-heading text-3xl font-bold text-slate-950 dark:text-white">
                    {price}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">
                    Indicative listing fee
                  </p>
                </div>
              )}

              {showFeaturedNote && (
                <div className="flex gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-950 dark:border-gold-400/30 dark:bg-gold-400/10 dark:text-gold-300">
                  <Award className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <p>This listing is tagged for excellence.</p>
                </div>
              )}

              {listing.phone && (
                <a
                  href={`tel:${listing.phone}`}
                  aria-label={`Call ${listing.clinic ?? listing.name}`}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 font-heading text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  Call {listing.clinic ?? listing.name}
                </a>
              )}
            </aside>
          </div>
        </article>

        <div className="mt-6">
          <AppointmentRequestPreview provider={{ name: listing.name, phone: listing.phone }} />
        </div>
      </div>
    </div>
  );
}
