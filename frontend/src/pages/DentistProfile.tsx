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
import { isPatientRole } from "../auth/roles";
import { AppointmentRequestPreview } from "../components/dentists/AppointmentRequestPreview";
import { BookAppointmentInline } from "../components/dentists/BookAppointmentInline";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import StarRating from "../components/ui/StarRating";
import { useCountryConfig } from "../hooks/useCountryConfig";
import { useListingDetail } from "../hooks/useListingDetail";
import type { AuthUser } from "../lib/auth";
import type { ListingType } from "../lib/listingApi";
import { formatListingPrice } from "../utils/formatCurrency";
import { summarizeHours } from "../utils/hours";
import { subdivisionLabel } from "../utils/subdivisionLabel";

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong loading this profile.";
}

export function DentistProfile({ user }: { user: AuthUser | null }) {
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
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
        <output className="rounded-card border border-steel bg-paper px-10 py-8 text-center shadow-card-white">
          <p className="font-heading text-lg font-semibold text-ink">Loading profile…</p>
        </output>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
        <div className="w-full max-w-xl rounded-card border border-red-200 bg-paper p-8 text-center shadow-card-white sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-card bg-red-50 text-red-600">
            <TriangleAlert className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-medium tracking-[-0.04em] text-ink">
            Could not load this profile
          </h1>
          <p className="mt-3 text-slate">{describeError(error)}</p>
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
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
        <div className="w-full max-w-xl rounded-card border border-steel bg-paper p-8 text-center shadow-card-white sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-card bg-cloud text-charcoal">
            <Stethoscope className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-medium tracking-[-0.04em] text-ink">
            Dental provider not found
          </h1>
          <p className="mt-3 text-slate">
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
    <div className="bg-paper py-8 sm:py-10 lg:py-12">
      <div className="app-container max-w-6xl">
        <Link
          to="/find-dentist"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-charcoal hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to dentist search
        </Link>

        <article className="mt-5 overflow-hidden rounded-card border border-steel bg-paper shadow-card-white">
          <div className="bg-cloud px-6 py-10 sm:px-10 sm:py-12">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-card bg-paper text-charcoal shadow-card-white">
                <ListingIcon className="h-10 w-10" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-medium text-slate">{typeLabel}</p>
                  {showVerifiedBadge && (
                    <Badge variant="success" className="gap-1">
                      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                      Verified listing
                    </Badge>
                  )}
                </div>
                <h1 className="mt-2 font-display text-3xl font-medium tracking-[-0.04em] text-ink sm:text-4xl">
                  {listing.name}
                </h1>
                {listing.clinic && <p className="mt-2 text-lg text-slate">{listing.clinic}</p>}
              </div>
            </div>
          </div>

          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)] lg:p-10">
            <div>
              <div className="flex flex-wrap items-center gap-4">
                {listing.rating !== null && <StarRating rating={listing.rating} size="lg" />}
                <span className="text-sm text-slate">
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
                    className="font-heading text-lg font-semibold text-ink"
                  >
                    Specialties and services
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {listing.specialties.map((specialty) => (
                      <Badge key={specialty} variant="neutral">
                        {specialty}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}

              <section className="mt-8" aria-labelledby="details-heading">
                <h2 id="details-heading" className="font-heading text-lg font-semibold text-ink">
                  Location and availability
                </h2>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="flex gap-3 rounded-card bg-cloud p-4">
                    <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-charcoal" aria-hidden="true" />
                    <div>
                      <dt className="text-xs font-medium text-slate">Location</dt>
                      <dd className="mt-1 text-sm text-charcoal">
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
                  <div className="flex gap-3 rounded-card bg-cloud p-4">
                    <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-charcoal" aria-hidden="true" />
                    <div>
                      <dt className="text-xs font-medium text-slate">Hours</dt>
                      <dd className="mt-1 text-sm text-charcoal">
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
                  <div className="flex gap-3 rounded-card bg-cloud p-4">
                    <CalendarDays
                      className="mt-0.5 h-5 w-5 shrink-0 text-charcoal"
                      aria-hidden="true"
                    />
                    <div>
                      <dt className="text-xs font-medium text-slate">Status</dt>
                      <dd className="mt-1 text-sm text-charcoal">
                        {listing.openNow ? "Open now" : "Closed"}
                      </dd>
                    </div>
                  </div>
                </dl>
              </section>

              <div className="mt-8 flex gap-3 rounded-card border border-steel p-4 text-sm leading-6 text-charcoal">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-green-600" aria-hidden="true" />
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
                <div className="rounded-card border border-steel bg-cloud p-5">
                  <p className="text-xs font-medium text-slate">Consultation from</p>
                  <p className="mt-1 font-heading text-3xl font-semibold text-ink">{price}</p>
                  <p className="mt-1 text-xs text-slate">Indicative listing fee</p>
                </div>
              )}

              {showFeaturedNote && (
                <div className="flex gap-3 rounded-card border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                  <Award className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <p>This listing is tagged for excellence.</p>
                </div>
              )}

              <BookAppointmentInline
                listingType={listing.listingType}
                listingId={listing.id}
                listingName={listing.name}
                user={user}
              />

              {listing.phone && (
                <a
                  href={`tel:${listing.phone}`}
                  aria-label={`Call ${listing.clinic ?? listing.name}`}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-button bg-ink px-5 py-3 font-heading text-sm font-semibold text-paper transition hover:bg-graphite"
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  Call {listing.clinic ?? listing.name}
                </a>
              )}
            </aside>{" "}
          </div>
        </article>

        <div className="mt-6">
          {/* The real booking form replaces the preview for whoever can use it:
              two appointment affordances on one page, and two aqua buttons,
              would fight each other. */}
          {!isPatientRole(user) && (
            <AppointmentRequestPreview provider={{ name: listing.name, phone: listing.phone }} />
          )}
        </div>
      </div>
    </div>
  );
}
