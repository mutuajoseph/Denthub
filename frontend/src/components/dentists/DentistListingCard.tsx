import {
  Award,
  Building2,
  CheckCircle2,
  Clock3,
  MapPin,
  Phone,
  Stethoscope,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { DentistListing } from "../../lib/dentistFixtures";
import { cn } from "../../utils/cn";
import Badge from "../ui/Badge";
import StarRating from "../ui/StarRating";

export type DentistListingCardVariant = "grid" | "list" | "compact";

export interface DentistListingCardProps {
  listing: DentistListing;
  variant?: DentistListingCardVariant;
  showPhone?: boolean;
}

function formatPrice(listing: DentistListing): string {
  const amount = new Intl.NumberFormat("en", {
    maximumFractionDigits: 0,
  }).format(listing.pricing.amount);
  return `${listing.pricing.currency} ${amount}`;
}

function insuranceLabels(listing: DentistListing): string[] {
  return Array.from(
    new Set(
      [listing.insurance.nationalScheme, ...listing.insurance.accepted].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  );
}

export function DentistListingCard({
  listing,
  variant = "grid",
  showPhone = false,
}: DentistListingCardProps) {
  const profilePath = `/dentists/${encodeURIComponent(listing.id)}`;
  const typeLabel =
    listing.listingType === "specialist" ? "Specialist physician" : "Dental practice";
  const ListingIcon = listing.listingType === "specialist" ? Stethoscope : Building2;
  const insurance = insuranceLabels(listing);

  if (variant === "compact") {
    return (
      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-navy-600 dark:bg-navy-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600 dark:bg-navy-700 dark:text-gold-300">
              <ListingIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-600 dark:text-gold-300">
                {typeLabel}
              </p>
              <h3 className="mt-0.5 truncate font-heading text-base font-semibold text-slate-900 dark:text-white">
                <Link to={profilePath} className="hover:text-orange-600 dark:hover:text-gold-300">
                  {listing.name}
                </Link>
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
                {[listing.clinic, listing.location.city, listing.location.subdivision]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-semibold",
                listing.hours.openNow ? "text-green-700 dark:text-green-400" : "text-slate-500",
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  listing.hours.openNow ? "bg-green-500" : "bg-slate-400",
                )}
                aria-hidden="true"
              />
              {listing.hours.openNow ? "Open in fixture" : "Closed in fixture"}
            </span>
            {showPhone && (
              <a
                href={`tel:${listing.contact.phone}`}
                aria-label={`Call ${listing.name}`}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
                Call now
              </a>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.06)] transition duration-200 hover:-translate-y-1 hover:border-orange-300 hover:shadow-[0_18px_45px_rgba(15,23,42,0.10)] dark:border-navy-600 dark:bg-navy-800 dark:hover:border-gold-400/40",
        variant === "list" && "md:flex md:items-stretch",
      )}
    >
      <div
        className={cn(
          "relative flex min-h-28 items-center justify-center overflow-hidden bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:from-navy-700 dark:via-navy-800 dark:to-navy-700",
          variant === "list" && "md:flex md:w-44 md:min-h-full md:shrink-0",
        )}
      >
        <div
          className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-gold-400/10"
          aria-hidden="true"
        />
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-orange-600 shadow-sm dark:bg-navy-900 dark:text-gold-300">
          <ListingIcon className="h-7 w-7" aria-hidden="true" />
        </div>
      </div>

      <div className={cn("flex flex-1 flex-col p-5", variant === "list" && "md:p-6")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-600 dark:text-gold-300">
              {typeLabel}
            </p>
            <h3 className="mt-1 font-heading text-lg font-semibold text-slate-900 dark:text-white">
              <Link to={profilePath} className="hover:text-orange-600 dark:hover:text-gold-300">
                {listing.name}
              </Link>
            </h3>
            {listing.clinic && (
              <p className="mt-0.5 text-sm text-slate-500 dark:text-gray-400">{listing.clinic}</p>
            )}
          </div>
          {listing.verification.approved && (
            <Badge variant="green" className="gap-1">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              Verified
            </Badge>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {listing.specialties.map((specialty) => (
            <Badge key={specialty}>{specialty}</Badge>
          ))}
          {listing.verification.excellence && (
            <Badge variant="orange" className="gap-1">
              <Award className="h-3 w-3" aria-hidden="true" />
              Excellence
            </Badge>
          )}
        </div>

        {variant === "list" && listing.listingType === "practice" && (
          <p className="mt-3 text-sm text-slate-500 dark:text-gray-400">
            <span className="font-medium text-slate-700 dark:text-gray-300">Areas served: </span>
            {listing.location.operatingAreas.join(", ")}
          </p>
        )}

        <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-gray-300">
          <p className="flex items-start gap-2">
            <MapPin
              className="mt-0.5 h-4 w-4 shrink-0 text-orange-500 dark:text-gold-400"
              aria-hidden="true"
            />
            <span>
              {listing.location.city}, {listing.location.subdivision} ·{" "}
              {listing.location.countryCode}
            </span>
          </p>
          <p className="flex items-center gap-2">
            <Clock3
              className="h-4 w-4 shrink-0 text-orange-500 dark:text-gold-400"
              aria-hidden="true"
            />
            {listing.hours.summary}
          </p>
          {listing.teamSize !== undefined && (
            <p className="flex items-center gap-2">
              <Users
                className="h-4 w-4 shrink-0 text-orange-500 dark:text-gold-400"
                aria-hidden="true"
              />
              {listing.teamSize} clinicians
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-navy-600">
          <div>
            <StarRating rating={listing.rating} />
            <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">
              {listing.reviewCount} reviews
            </p>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-semibold",
              listing.hours.openNow
                ? "text-green-700 dark:text-green-400"
                : "text-slate-500 dark:text-gray-400",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                listing.hours.openNow ? "bg-green-500" : "bg-slate-400",
              )}
              aria-hidden="true"
            />
            {listing.hours.openNow ? "Open now" : "Closed"}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500 dark:text-gray-400">Consultation from</p>
            <p className="mt-0.5 font-heading text-lg font-semibold text-slate-900 dark:text-white">
              {formatPrice(listing)}
            </p>
          </div>
          <Link
            to={profilePath}
            aria-label={`View profile for ${listing.name}`}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border-2 border-orange-500 px-4 py-2 font-heading text-sm font-semibold text-orange-600 transition hover:bg-orange-50 dark:border-gold-400 dark:text-gold-300 dark:hover:bg-gold-400/10"
          >
            View profile
          </Link>
        </div>

        {insurance.length > 0 && (
          <p className="mt-4 text-xs text-slate-500 dark:text-gray-400">
            Insurance accepted: {insurance.slice(0, 3).join(", ")}
            {insurance.length > 3 ? ` +${insurance.length - 3}` : ""}
          </p>
        )}
      </div>
    </article>
  );
}
