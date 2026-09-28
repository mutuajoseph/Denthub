import { ArrowRight, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { useCountryConfig } from "../../hooks/useCountryConfig";
import { useDentistSearch } from "../../hooks/useDentistSearch";
import type { DentistCard, PracticeCard } from "../../lib/searchApi";
import { useSiteContentStore } from "../../store/siteContentStore";
import { initialsOf } from "../../utils/initials";
import Badge from "../ui/Badge";
import StarRating from "../ui/StarRating";

type FeaturedListing = (DentistCard | PracticeCard) & {
  operatingAreas?: string[];
  clinic?: string;
};

export default function FeaturedClinics() {
  const heading = useSiteContentStore((s) => s.home.featuredClinicsTitle);
  const { data } = useDentistSearch({});
  const { insuranceSchemeLabel } = useCountryConfig();

  const featured: FeaturedListing[] = data?.practices?.length
    ? data.practices.slice(0, 3)
    : (data?.specialists?.slice(0, 3) as FeaturedListing[]) || [];

  // The search API is not built yet; until it returns listings, show nothing
  // rather than a heading over an empty band.
  if (featured.length === 0) return null;

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

        <ul className="mt-12 grid gap-4 md:grid-cols-3">
          {featured.map((d) => {
            const isPractice = d.listingType === "practice" || Boolean(d.operatingAreas?.length);
            const specialty = Array.isArray(d.specialty) ? d.specialty : [];
            const clinicName = "clinic" in d ? d.clinic : undefined;
            return (
              <li key={d.id}>
                <Link
                  to={`/dentists/${d.id}`}
                  className="card-hover flex h-full flex-col rounded-card bg-cloud p-4 ring-1 ring-inset ring-black/[0.06]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-button bg-graphite font-display text-base font-medium text-paper shadow-edge"
                      aria-hidden="true"
                    >
                      {initialsOf(d.name)}
                    </span>
                    <span className="text-xs font-medium text-charcoal">
                      {isPractice ? "Practice" : "Specialist"}
                    </span>
                  </div>

                  <div className="mt-6 rounded-button bg-paper p-4 shadow-card-white">
                    <h3 className="text-lg font-semibold leading-tight tracking-[-0.02em] text-ink">
                      {d.name}
                    </h3>
                    <p className="mt-1 truncate text-sm text-slate">
                      {isPractice ? specialty.slice(0, 2).join(" · ") : clinicName}
                    </p>
                    <p className="mt-3 flex items-center gap-1.5 text-sm text-charcoal">
                      <MapPin
                        className="h-3.5 w-3.5 shrink-0"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                      {d.town}
                      {d.county ? `, ${d.county}` : ""}
                    </p>
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                    <StarRating rating={d.rating} />
                    {d.nhif && <Badge variant="neutral">{insuranceSchemeLabel}</Badge>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
