import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { JOBS_BOARD_LIMIT } from "../config/jobConstants";
import { type JobPageWire, type JobSearchParams, fetchJobs, mapJob } from "../lib/jobsApi";
import { useSpecialties } from "./useSpecialties";

/**
 * The market's published postings as `JobView`s, one page per request.
 *
 * The query key lists every input the request reads (country, subdivision,
 * specialty, page size, offset), so a region or filter switch refetches rather
 * than serving another market's cache. `placeholderData` keeps the previous
 * board visible while a switch loads, so the grid never flashes empty.
 */
export function useJobs(params: JobSearchParams) {
  const { nameOf } = useSpecialties();

  const query = useQuery<JobPageWire>({
    queryKey: [
      "jobs-board",
      params.country,
      params.subdivisionCode ?? "",
      params.specialtyCode ?? "",
      params.limit ?? JOBS_BOARD_LIMIT,
      params.offset ?? 0,
    ],
    queryFn: ({ signal }) => fetchJobs({ limit: JOBS_BOARD_LIMIT, ...params }, signal),
    placeholderData: (previous) => previous,
    staleTime: 60 * 1000,
  });

  const jobs = useMemo(
    () => (query.data?.items ?? []).map((wire) => mapJob(wire, nameOf)),
    [query.data, nameOf],
  );

  return {
    jobs,
    /** How many postings match the filters, from `total` on the served page. */
    total: query.data?.total ?? 0,
    /** The currency the market prices postings in. */
    marketCurrency: query.data?.currency,
    isLoading: query.isPending,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
