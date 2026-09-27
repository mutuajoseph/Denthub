import type { Job } from "../../lib/jobFixtures";
import { formatMoney } from "../../utils/formatCurrency";
import Badge from "../ui/Badge";

export interface JobCardProps {
  job: Job;
}

function salaryRange(job: Job): string {
  if (job.salaryMin === null) return "Competitive";

  const from = formatMoney(job.salaryMin);

  return job.salaryMax === null || job.salaryMax === job.salaryMin
    ? from
    : `${from} – ${formatMoney(job.salaryMax)}`;
}

export function JobCard({ job }: JobCardProps) {
  return (
    <article className="rounded-xl border border-gray-200 border-l-4 border-l-orange-400 bg-white p-5 shadow-sm transition-all dark:border-navy-600 dark:border-l-gold-400 dark:bg-navy-800 dark:shadow-none">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-heading font-bold text-gray-900 dark:text-white">{job.title}</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{job.clinic}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="navy">{job.subdivision}</Badge>
        <Badge variant="orange">{job.employment}</Badge>
        <Badge variant="gold">{job.type}</Badge>
      </div>

      <p className="mt-3 font-semibold text-orange-500 dark:text-gold-300">{salaryRange(job)}</p>

      <p className="mt-2 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
        {job.requirements}
      </p>

      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">Posted {job.posted}</p>
    </article>
  );
}
