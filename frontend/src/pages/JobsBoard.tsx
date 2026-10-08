import { Briefcase } from "lucide-react";
import { useMemo, useState } from "react";

import { JobCard } from "../components/jobs/JobCard";
import Button from "../components/ui/Button";
import { JOBS_BOARD_LIMIT, JOBS_PAGE_SIZE, JOB_EMPLOYMENT_TYPES } from "../config/jobConstants";
import { getStaticSubdivisions } from "../config/subdivisions";
import { useJobs } from "../hooks/useJobs";
import { useRegion } from "../hooks/useRegion";
import { useSpecialties } from "../hooks/useSpecialties";
import { useSiteContentStore } from "../store/siteContentStore";

export function JobsBoard() {
  const { regionCode, countiesLabel, locale } = useRegion();
  const { title, subtitle } = useSiteContentStore((s) => s.jobsBoard);

  const [employment, setEmployment] = useState("");
  const [specialtyCode, setSpecialtyCode] = useState("");
  const [subdivisionCode, setSubdivisionCode] = useState("");
  // "Show all" is a toggle that must go back off when the country changes; keying
  // it by country makes the reset automatic rather than an effect.
  const [expandedIn, setExpandedIn] = useState<string | null>(null);

  const countryCode = regionCode === "GLOBAL" ? "KE" : regionCode;
  const subdivisions = useMemo(() => getStaticSubdivisions(countryCode), [countryCode]);
  const specialtyOptions = useSpecialties().options;

  // A subdivision picked in one country has no meaning in another, so a region
  // switch drops it rather than silently filtering everything out. Membership
  // in the current country's static list does that without a reset effect.
  const activeSubdivision = subdivisions.some((option) => option.code === subdivisionCode)
    ? subdivisionCode
    : "";

  const showAll = expandedIn === countryCode;
  const hasFilters = employment !== "" || specialtyCode !== "" || activeSubdivision !== "";

  const { jobs, total, error, isLoading, isFetching, refetch } = useJobs({
    country: countryCode,
    subdivisionCode: activeSubdivision || undefined,
    specialtyCode: specialtyCode || undefined,
    limit: JOBS_BOARD_LIMIT,
  });

  // Employment is a display filter (the API filters by subdivision and
  // specialty), so it narrows the served board in memory.
  const filtered =
    employment === "" ? jobs : jobs.filter((job) => job.employmentType === employment);
  const visible = showAll ? filtered : filtered.slice(0, JOBS_PAGE_SIZE);

  function resetPagination() {
    setExpandedIn(null);
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
            <label
              className="text-xs text-gray-500 dark:text-gray-400"
              htmlFor="jobs-filter-employment"
            >
              Employment Type
            </label>
            <select
              id="jobs-filter-employment"
              value={employment}
              onChange={(event) => {
                setEmployment(event.target.value);
                resetPagination();
              }}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-navy-600 dark:bg-navy-900 dark:text-white"
            >
              <option value="">All Types</option>
              {JOB_EMPLOYMENT_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              className="text-xs text-gray-500 dark:text-gray-400"
              htmlFor="jobs-filter-specialty"
            >
              Specialty
            </label>
            <select
              id="jobs-filter-specialty"
              value={specialtyCode}
              onChange={(event) => {
                setSpecialtyCode(event.target.value);
                resetPagination();
              }}
              disabled={specialtyOptions.length === 0}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 disabled:opacity-50 dark:border-navy-600 dark:bg-navy-900 dark:text-white"
            >
              <option value="">All Specialties</option>
              {specialtyOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.name}
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
              value={activeSubdivision}
              onChange={(event) => {
                setSubdivisionCode(event.target.value);
                resetPagination();
              }}
              disabled={subdivisions.length === 0}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 disabled:opacity-50 dark:border-navy-600 dark:bg-navy-900 dark:text-white"
            >
              <option value="">All</option>
              {subdivisions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
        </aside>

        <div className="grid gap-6 md:grid-cols-2 lg:col-span-3">
          {isLoading && jobs.length === 0 ? (
            <div className="py-16 text-center md:col-span-2" aria-busy="true">
              <p className="font-heading text-lg font-semibold text-gray-700 dark:text-gray-200">
                Loading jobs…
              </p>
            </div>
          ) : error && jobs.length === 0 ? (
            <div className="py-16 text-center md:col-span-2" role="alert">
              <p className="font-heading text-lg font-semibold text-red-600 dark:text-red-400">
                Could not load the jobs board.
              </p>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{error.message}</p>
              <Button variant="secondary" className="mt-4" onClick={() => void refetch()}>
                Try again
              </Button>
            </div>
          ) : visible.length > 0 ? (
            visible.map((job) => <JobCard key={job.id} job={job} locale={locale} />)
          ) : (
            <div className="py-16 text-center md:col-span-2">
              <p className="font-heading text-lg font-semibold text-gray-700 dark:text-gray-200">
                {hasFilters ? "No jobs match those filters." : "No jobs listed in your region yet."}
              </p>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {hasFilters
                  ? "Try widening your employment, specialty, or region filter."
                  : "Try another country, or check back as new roles are posted."}
              </p>
            </div>
          )}
        </div>
      </div>

      {!error && total > JOBS_PAGE_SIZE && (
        <div className="mt-8 text-center">
          <Button variant="secondary" onClick={() => setExpandedIn(showAll ? null : countryCode)}>
            {showAll ? "Show Less" : `Show All ${total} Jobs`}
          </Button>
        </div>
      )}

      {isFetching && jobs.length > 0 && (
        <p className="mt-6 text-center text-sm text-gray-400 dark:text-gray-500">Refreshing…</p>
      )}
    </div>
  );
}
