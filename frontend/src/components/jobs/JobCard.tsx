import type { JobView } from "../../lib/jobsApi";
import { postedLabel } from "../../lib/jobsApi";
import { formatListingPrice } from "../../utils/formatCurrency";
import { subdivisionLabel } from "../../utils/subdivisionLabel";
import Badge from "../ui/Badge";

export interface JobCardProps {
  job: JobView;
  /** The market locale, so a salary in the posting's own currency reads right. */
  locale: string;
}

function salaryRange(job: JobView, locale: string): string {
  if (job.salary === null || job.salary.minAmount === null) return "Competitive";

  const from = formatListingPrice(job.salary.minAmount, job.salary.currency, locale);
  if (from === null) return "Competitive";

  if (job.salary.maxAmount === null || job.salary.maxAmount === job.salary.minAmount) {
    return from;
  }

  return `${from} – ${formatListingPrice(job.salary.maxAmount, job.salary.currency, locale)}`;
}

export function JobCard({ job, locale }: JobCardProps) {
  return (
    <article className="rounded-card border border-steel border-l-4 border-l-ink bg-paper p-5 shadow-card-white transition-shadow hover:shadow-card-cloud">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-heading font-semibold text-ink">{job.title}</h3>
          <p className="mt-1 text-sm text-slate">{job.workplace.facilityName}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="neutral">{subdivisionLabel(job.workplace.subdivisionCode)}</Badge>
        <Badge variant="graphite">{job.employmentType}</Badge>
        <Badge variant="ink">{job.seniority}</Badge>
      </div>

      {job.specialties.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {job.specialties.map((name) => (
            <Badge key={name} variant="neutral">
              {name}
            </Badge>
          ))}
        </div>
      )}

      <p className="mt-3 font-semibold text-ink">{salaryRange(job, locale)}</p>

      <p className="mt-2 line-clamp-2 text-sm text-charcoal">
        {job.requirements ?? job.description}
      </p>

      <p className="mt-2 text-xs text-slate">{postedLabel(job.postedAt)}</p>
    </article>
  );
}
