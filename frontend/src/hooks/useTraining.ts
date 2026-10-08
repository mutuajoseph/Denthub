import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { TRAINING_PAGE_LIMIT } from "../config/courseConstants";
import {
  type TrainingCoursePageWire,
  type TrainingCourseParams,
  type TrainingWebinarPageWire,
  type TrainingWebinarParams,
  fetchTrainingCourses,
  fetchTrainingWebinars,
  mapCoursePage,
  mapWebinarPage,
} from "../lib/trainingApi";
import { useCountryConfigStore } from "../store/countryConfigStore";
import { useRegionStore } from "../store/regionStore";

export function useTrainingCourses(params: TrainingCourseParams) {
  const query = useQuery<TrainingCoursePageWire>({
    queryKey: [
      "training-courses",
      params.country,
      params.subdivisionCode ?? "",
      params.provider ?? "",
      params.deliveryMode ?? "",
      params.limit ?? TRAINING_PAGE_LIMIT,
      params.offset ?? 0,
    ],
    queryFn: ({ signal }) =>
      fetchTrainingCourses({ limit: TRAINING_PAGE_LIMIT, ...params }, signal),
    placeholderData: (previous) => previous,
    staleTime: 60_000,
  });

  const courses = useMemo(() => (query.data ? mapCoursePage(query.data).items : []), [query.data]);

  return {
    courses,
    total: query.data?.total ?? 0,
    marketCurrency: query.data?.currency,
    // The query's own status union, surfaced unnamed so callers stay free.
    isLoading: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useTrainingWebinars(params: TrainingWebinarParams) {
  const query = useQuery<TrainingWebinarPageWire>({
    queryKey: [
      "training-webinars",
      params.country,
      params.provider ?? "",
      params.upcoming ?? "",
      params.limit ?? TRAINING_PAGE_LIMIT,
      params.offset ?? 0,
    ],
    queryFn: ({ signal }) =>
      fetchTrainingWebinars({ limit: TRAINING_PAGE_LIMIT, ...params }, signal),
    placeholderData: (previous) => previous,
    staleTime: 60_000,
  });

  const webinars = useMemo(
    () => (query.data ? mapWebinarPage(query.data).items : []),
    [query.data],
  );

  return {
    webinars,
    total: query.data?.total ?? 0,
    isLoading: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Whether the active market offers CPD training, straight from the flag.
 *
 * Reads the config store directly rather than running the fetch effect that
 * `useCountryConfig` would trigger, so the nav chrome stays free of a
 * data-fetching side effect. Re-keys whenever the region or the config for it
 * lands, so switching country in the navigator updates the nav immediately.
 */
export function useTrainingEnabled(): boolean {
  const regionCode = useRegionStore((state) => state.regionCode || state.getRegion().code);
  const config = useCountryConfigStore((state) => state.config);
  const country = regionCode === "GLOBAL" ? "KE" : regionCode;

  return config?.code === country && Boolean(config.features.CPD_TRAINING);
}
