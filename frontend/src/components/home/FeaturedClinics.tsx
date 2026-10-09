import { ArrowRight, MapPin, SearchX, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { useCountryConfig } from "../../hooks/useCountryConfig";
import { useHomeFeatured } from "../../hooks/useHome";
import { useRegion } from "../../hooks/useRegion";
import type { ListingView } from "../../lib/listingApi";
import { useSiteContentStore } from "../../store/siteContentStore";
import { initialsOf } from "../../utils/initials";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import StarRating from "../ui/StarRating";

function FeaturedCard({ listing }: { listing: ListingView }) {
  const isFacility = listing.listingType === "facility";
  const isVerified = listing.verificationTier !== null && listing.verificationTier !== "unverified";
  const subtitle = isFacility ? listing.specialties.slice(0, 2).join(" · ") : listing.clinic;

  return (
    <li>
      <Link
        to={`/dentists/${listing.id}`}
        className="card-hover flex h-full flex-col rounded-card bg-cloud p-4 ring-1 ring-inset ring-black/[0.06]"
      >
        <div className="flex items-center justify-between gap-3">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-button bg-graphite font-display text-base font-medium text-paper shadow-edge"
            aria-hidden="true"
          >
            {initialsOf(listing.name)}
          </span>
          <span className="text-xs font-medium text-charcoal">
            {isFacility ? "Practice" : "Specialist"}
          </span>
        </div>

        <div className="mt-6 rounded-button bg-paper p-4 shadow-card-white">
          <h3 className="text-lg font-semibold leading-tight tracking-[-0.02em] text-ink">
            {listing.name}
          </h3>
          {subtitle && <p className="mt-1 truncate text-sm text-slate">{subtitle}</p>}
          <p className="mt-3 flex items-center gap-1.5 text-sm text-charcoal">
            <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
            {listing.subdivisionCode}
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          {listing.rating !== null ? (
            <StarRating rating={listing.rating} />
          ) : (
            <span className="text-xs font-medium text-slate">No reviews yet</span>
          )}
          {isVerified && <Badge variant="neutral">Verified</Badge>}
        </div>
      </Link>
    </li>
  );
}

export default function FeaturedClinics() {
  const heading = useSiteContentStore((s) => s.home.featuredClinicsTitle);
  const { apiCountry } = useCountryConfig();
  const { countryName } = useRegion();
  const { listings: featured, isPending, hasLoaded, error, refetch } = useHomeFeatured(apiCountry);

  // The market is still loading (a first load or a region switch): keep the
  // band from flashing the previous market's cards.
  if (isPending && !hasLoaded) return null;

  return (
    <section className="bg-paper" aria-labelledby="featured-heading">
      <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2
            id="featured-heading"
            className="font-display text-[2.5rem] font-normal leading-none tracking-[-0.04em] text-ink sm:text-display-section"
          >
            {heading}
          </h2>
          <Link
            to="/dentists"
            className="inline-flex items-center gap-2 rounded-link text-sm font-medium text-ink underline decoration-steel underline-offset-4 transition-colors hover:decoration-ink"
          >
            View all dentists
            <ArrowRight className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
          </Link>
        </div>

        {error && featured.length === 0 ? (
          <div
            role="alert"
            className="mt-12 flex flex-col items-center gap-4 rounded-card bg-cloud px-6 py-14 text-center ring-1 ring-inset ring-black/[0.06]"
          >
            <TriangleAlert className="h-8 w-8 text-charcoal" aria-hidden="true" />
            <p className="text-base text-ink">Could not load clinics for {countryName}.</p>
            <Button variant="secondary" size="md" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        ) : featured.length > 0 ? (
          <ul className="mt-12 grid gap-4 md:grid-cols-3">
            {featured.map((listing) => (
              <FeaturedCard key={listing.id} listing={listing} />
            ))}
          </ul>
        ) : (
          <div className="mt-12 flex flex-col items-center gap-4 rounded-card bg-cloud px-6 py-14 text-center ring-1 ring-inset ring-black/[0.06]">
            <SearchX className="h-8 w-8 text-charcoal" aria-hidden="true" />
            <p className="text-base text-ink">No clinics listed in {countryName} yet.</p>
            <p className="max-w-md text-sm text-slate">
              When the first clinic in {countryName} signs up, its card appears here.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
