import { Award, Building2, CheckCircle2, MapPin, Phone, Stethoscope } from "lucide-react";
import { Link } from "react-router-dom";
import type { ListingView } from "../../lib/listingApi";
import { useCountryConfigStore } from "../../store/countryConfigStore";
import { cn } from "../../utils/cn";
import { formatListingPrice } from "../../utils/formatCurrency";
import { subdivisionLabel } from "../../utils/subdivisionLabel";
import Badge from "../ui/Badge";
import StarRating from "../ui/StarRating";

export type DentistListingCardVariant = "grid" | "list" | "compact";

export interface DentistListingCardProps {
  listing: ListingView;
  variant?: DentistListingCardVariant;
  showPhone?: boolean;
}

export function DentistListingCard({
  listing,
  variant = "grid",
  showPhone = false,
}: DentistListingCardProps) {
  // Read the loaded market's names without triggering a load per card: the
  // page already mounts `useCountryConfig`, and an unknown code degrades to a
  // prettified label rather than an empty line.
  const regions = useCountryConfigStore((s) => s.regions);
  const profilePath = `/dentists/${listing.listingType}/${encodeURIComponent(listing.id)}`;
  const typeLabel = listing.listingType === "specialist" ? "Dental specialist" : "Dental practice";
  const ListingIcon = listing.listingType === "specialist" ? Stethoscope : Building2;
  const showVerifiedBadge =
    listing.listingType === "facility" &&
    (listing.verificationTier === "verified" || listing.verificationTier === "featured");
  const showFeaturedNote =
    listing.listingType === "facility" && listing.verificationTier === "featured";
  const subdivisionName =
    regions.find((row) => row.code === listing.subdivisionCode)?.name ??
    subdivisionLabel(listing.subdivisionCode);
  const price = formatListingPrice(listing.amount, listing.currency);

  if (variant === "compact") {
    return (
      <article className="rounded-card border border-steel bg-paper p-4 shadow-card-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-button bg-cloud text-charcoal">
              <ListingIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate">{typeLabel}</p>
              <h3 className="mt-0.5 truncate font-heading text-base font-semibold text-ink">
                <Link to={profilePath} className="hover:text-charcoal">
                  {listing.name}
                </Link>
              </h3>
              <p className="mt-1 text-sm text-slate">
                {[listing.clinic, subdivisionName, listing.countryCode].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-semibold",
                listing.openNow ? "text-green-700" : "text-slate",
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  listing.openNow ? "bg-green-500" : "bg-steel",
                )}
                aria-hidden="true"
              />
              {listing.openNow ? "Open now" : "Closed"}
            </span>
            {showPhone && listing.phone && (
              <a
                href={`tel:${listing.phone}`}
                aria-label={`Call ${listing.name}`}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-button bg-ink px-4 py-2 text-sm font-semibold text-paper transition hover:bg-graphite"
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
        "overflow-hidden rounded-card border border-steel bg-paper shadow-card-white transition duration-200 hover:-translate-y-1 hover:shadow-card-cloud",
        variant === "list" && "md:flex md:items-stretch",
      )}
    >
      <div
        className={cn(
          "relative flex min-h-28 items-center justify-center overflow-hidden bg-cloud",
          variant === "list" && "md:flex md:w-44 md:min-h-full md:shrink-0",
        )}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-card bg-paper text-charcoal shadow-card-white">
          <ListingIcon className="h-7 w-7" aria-hidden="true" />
        </div>
      </div>

      <div className={cn("flex flex-1 flex-col p-5", variant === "list" && "md:p-6")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate">{typeLabel}</p>
            <h3 className="mt-1 font-heading text-lg font-semibold text-ink">
              <Link to={profilePath} className="hover:text-charcoal">
                {listing.name}
              </Link>
            </h3>
            {listing.clinic && <p className="mt-0.5 text-sm text-slate">{listing.clinic}</p>}
          </div>
          {showVerifiedBadge && (
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              Verified
            </Badge>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {listing.specialties.map((specialty) => (
            <Badge key={specialty} variant="neutral">
              {specialty}
            </Badge>
          ))}
          {showFeaturedNote && (
            <Badge variant="ink" className="gap-1">
              <Award className="h-3 w-3" aria-hidden="true" />
              Excellence
            </Badge>
          )}
        </div>

        <div className="mt-4 space-y-2 text-sm text-charcoal">
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-charcoal" aria-hidden="true" />
            <span>
              {subdivisionName} · {listing.countryCode}
            </span>
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-steel pt-4">
          <div>
            {listing.rating !== null && <StarRating rating={listing.rating} />}
            <p className={cn("text-xs text-slate", listing.rating !== null && "mt-1")}>
              {listing.reviewCount > 0 ? `${listing.reviewCount} reviews` : "No reviews yet"}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-semibold",
              listing.openNow ? "text-green-700" : "text-slate",
            )}
          >
            <span
              className={cn("h-2 w-2 rounded-full", listing.openNow ? "bg-green-500" : "bg-steel")}
              aria-hidden="true"
            />
            {listing.openNow ? "Open now" : "Closed"}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          {price && (
            <div>
              <p className="text-xs text-slate">Consultation from</p>
              <p className="mt-0.5 font-heading text-lg font-semibold text-ink">{price}</p>
            </div>
          )}
          <Link
            to={profilePath}
            aria-label={`View profile for ${listing.name}`}
            className="inline-flex min-h-11 items-center justify-center rounded-button border border-steel px-4 py-2 font-heading text-sm font-semibold text-ink transition hover:bg-cloud"
          >
            View profile
          </Link>
        </div>
      </div>
    </article>
  );
}
