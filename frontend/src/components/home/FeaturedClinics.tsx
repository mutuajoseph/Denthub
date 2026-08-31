import { Building2, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { useDentistSearch } from "../../hooks/useDentistSearch";
import { useRegion } from "../../hooks/useRegion";
import type { DentistCard, PracticeCard } from "../../lib/searchApi";
import { useSiteContentStore } from "../../store/siteContentStore";
import Badge from "../ui/Badge";
import StarRating from "../ui/StarRating";

type FeaturedListing = (DentistCard | PracticeCard) & {
  operatingAreas?: string[];
  clinic?: string;
};

export default function FeaturedClinics() {
  const heading = useSiteContentStore((s) => s.home.featuredClinicsTitle);
  const { data } = useDentistSearch({});
  const { regionCode } = useRegion();
  const insuranceByCountry: Record<string, string> = {
    NG: "NHIS",
    KE: "NHIF",
    IN: "PM-JAY",
    TR: "SGK",
  };
  const insuranceLabel = insuranceByCountry[regionCode] || "Insurance";

  const featured: FeaturedListing[] = data?.practices?.length
    ? data.practices.slice(0, 3)
    : (data?.specialists?.slice(0, 3) as FeaturedListing[]) || [];

  return (
    <section className="py-16 bg-slate-50 dark:bg-navy-950">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <h2 className="font-display text-3xl font-bold mb-8 text-slate-900 dark:text-white">
          {heading}
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {featured.map((d) => {
            const isPractice = d.listingType === "practice" || Boolean(d.operatingAreas?.length);
            const profilePath = isPractice ? `/dentists/${d.id}` : `/dentists/${d.id}`;
            const specialty = Array.isArray(d.specialty) ? d.specialty : [];
            const clinicName = "clinic" in d ? d.clinic : undefined;
            return (
              <Link
                key={d.id}
                to={profilePath}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] card-hover block dark:border-navy-600 dark:bg-navy-800"
              >
                <div className="h-32 rounded-xl bg-gradient-to-br from-orange-50 to-white flex items-center justify-center text-orange-500 mb-4 dark:from-navy-700 dark:to-navy-600 dark:text-gold-400">
                  <Building2 className="w-10 h-10" aria-hidden="true" />
                </div>
                <h3 className="font-heading font-semibold text-slate-900 dark:text-white">
                  {d.name}
                </h3>
                <p className="text-sm text-slate-500 dark:text-gray-400">
                  {isPractice ? specialty.slice(0, 2).join(" · ") : clinicName}
                </p>
                <div className="flex items-center gap-1 mt-2 text-sm text-slate-500 dark:text-gray-400">
                  <MapPin className="w-3 h-3" /> {d.town}
                  {d.county ? `, ${d.county}` : ""}
                </div>
                <div className="flex items-center justify-between mt-3">
                  <StarRating rating={d.rating} />
                  {d.nhif && <Badge variant="green">{insuranceLabel}</Badge>}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
