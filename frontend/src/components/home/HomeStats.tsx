import { useCountryConfig } from "../../hooks/useCountryConfig";
import { useHomeStats } from "../../hooks/useHome";
import { useRegion } from "../../hooks/useRegion";

function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

/**
 * The market's headline numbers as a figures band, every figure from
 * `/home/stats` — never marketing copy a release would have to correct.
 * Renders nothing until the active market's stats land, so a region switch
 * never shows one country's count under another's copy.
 */
export default function HomeStats() {
  const { apiCountry, subdivisionPlural } = useCountryConfig();
  const { locale } = useRegion();
  const query = useHomeStats(apiCountry);
  const stats = query.data;

  if (!stats) return null;

  const figures = [
    { label: "Clinics listed", value: stats.clinics_listed },
    { label: "Verified clinics", value: stats.verified_clinics },
    { label: "Specialists", value: stats.specialists },
    { label: `${subdivisionPlural} covered`, value: stats.counties_covered },
  ];

  return (
    <section className="border-y border-steel bg-paper" aria-label="DentHub in numbers">
      <dl className="mx-auto grid w-full max-w-7xl gap-x-6 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        {figures.map(({ label, value }) => (
          <div key={label} className="py-2">
            <dt className="font-mono text-xs uppercase tracking-[0.06em] text-slate">{label}</dt>
            <dd className="mt-3 font-display text-[2.5rem] font-medium leading-none tracking-[-0.04em] text-ink">
              {formatCount(value, locale)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
