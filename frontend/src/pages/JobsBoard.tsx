import { Briefcase } from "lucide-react";
import { useMemo, useState } from "react";

import { JobCard } from "../components/jobs/JobCard";
import Button from "../components/ui/Button";
import { JOBS_PAGE_SIZE, JOB_TYPES } from "../config/jobConstants";
import { getStaticSubdivisions } from "../config/subdivisions";
import { useRegion } from "../hooks/useRegion";
import { listJobFixtures } from "../lib/jobFixtures";
import { useSiteContentStore } from "../store/siteContentStore";

export function JobsBoard() {
  const { regionCode, countiesLabel } = useRegion();
  const { title, subtitle } = useSiteContentStore((s) => s.jobsBoard);

  const [type, setType] = useState("");
  const [subdivisionId, setSubdivisionId] = useState("");
  const [showAll, setShowAll] = useState(false);

  const countryCode = regionCode === "GLOBAL" ? "KE" : regionCode;
  const subdivisions = useMemo(() => getStaticSubdivisions(countryCode), [countryCode]);

  const jobsInRegion = useMemo(
    () => listJobFixtures().filter((job) => job.countryCode === countryCode),
    [countryCode],
  );

  const jobs = useMemo(
    () =>
      jobsInRegion.filter(
        (job) =>
          (type === "" || job.type === type) &&
          (subdivisionId === "" || job.subdivisionId === subdivisionId),
      ),
    [jobsInRegion, subdivisionId, type],
  );

  const visible = showAll ? jobs : jobs.slice(0, JOBS_PAGE_SIZE);

  function resetPagination() {
    setShowAll(false);
  }

  return (
    <div className="app-container py-8 text-gray-900 lg:py-12 dark:text-white">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-500 dark:bg-gold-400/10 dark:text-gold-400">
              <Briefcase className="h-5 w-5" aria-hidden="true" />
            </span>
            <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white">
              {title}
            </h1>
          </div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">{subtitle}</p>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-4">
        <aside
          className="h-fit space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-navy-600 dark:bg-navy-800"
          aria-label="Filter dental jobs"
        >
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400" htmlFor="jobs-filter-type">
              Job Type
            </label>
            <select
              id="jobs-filter-type"
              value={type}
              onChange={(event) => {
                setType(event.target.value);
                resetPagination();
              }}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-navy-600 dark:bg-navy-900 dark:text-white"
            >
              <option value="">All Types</option>
              {JOB_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              className="text-xs text-gray-500 dark:text-gray-400"
              htmlFor="jobs-filter-subdivision"
            >
              {countiesLabel}
            </label>
            <select
              id="jobs-filter-subdivision"
              value={subdivisionId}
              onChange={(event) => {
                setSubdivisionId(event.target.value);
                resetPagination();
              }}
              disabled={subdivisions.length === 0}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 disabled:opacity-50 dark:border-navy-600 dark:bg-navy-900 dark:text-white"
            >
              <option value="">All</option>
              {subdivisions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
        </aside>

        <div className="grid gap-6 md:grid-cols-2 lg:col-span-3">
          {visible.length > 0 ? (
            visible.map((job) => <JobCard key={job.id} job={job} />)
          ) : (
            <div className="py-16 text-center md:col-span-2">
              <p className="font-heading text-lg font-semibold text-gray-700 dark:text-gray-200">
                {jobsInRegion.length === 0
                  ? "No jobs listed in your region yet."
                  : "No jobs match those filters."}
              </p>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {jobsInRegion.length === 0
                  ? "Try another country, or check back as new roles are posted."
                  : "Try widening your job type or region filter."}
              </p>
            </div>
          )}
        </div>
      </div>

      {jobs.length > JOBS_PAGE_SIZE && (
        <div className="mt-8 text-center">
          <Button variant="secondary" onClick={() => setShowAll((open) => !open)}>
            {showAll ? "Show Less" : `Show All ${jobs.length} Jobs`}
          </Button>
        </div>
      )}
    </div>
  );
}
