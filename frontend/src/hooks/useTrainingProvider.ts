/**
 * Server state for the training-provider dashboard (#79).
 *
 * A training-provider account owns one provider and manages only that
 * provider's Courses and webinars. Every query here is scoped to the caller by
 * the backend, so a single query key serves the dashboard without a per-user
 * component. Mutations invalidate the `["training-provider"]` root so the
 * dashboard's derived stats refetch after any create or edit.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import {
  type CreateCourseInput,
  type CreateProviderInput,
  type CreateWebinarInput,
  type TrainingProviderDashboard,
  type UpdateCourseInput,
  type UpdateWebinarInput,
  createCourse,
  createMyProvider,
  createWebinar,
  fetchMyCourses,
  fetchMyProviderDashboard,
  fetchMyWebinars,
  updateCourse,
  updateWebinar,
} from "../lib/trainingProviderApi";

export const TRAINING_PROVIDER_PAGE_LIMIT = 48;

const ROOT_KEY = ["training-provider"] as const;

export function useTrainingProviderDashboard() {
  const query = useQuery<TrainingProviderDashboard | null>({
    queryKey: [...ROOT_KEY, "dashboard"],
    queryFn: ({ signal }) => fetchMyProviderDashboard(signal),
    staleTime: 30_000,
  });

  return {
    dashboard: query.data ?? null,
    provider: query.data?.provider ?? null,
    stats: query.data?.stats ?? null,
    isLoading: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useTrainingProviderCourses(
  limit = TRAINING_PROVIDER_PAGE_LIMIT,
  options: { enabled?: boolean } = {},
) {
  const query = useQuery({
    queryKey: [...ROOT_KEY, "courses", limit],
    queryFn: ({ signal }) => fetchMyCourses(limit, 0, signal),
    enabled: options.enabled ?? true,
    staleTime: 30_000,
  });

  const refetch = useCallback(() => query.refetch(), [query]);

  return {
    courses: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch,
  };
}

export function useTrainingProviderWebinars(
  limit = TRAINING_PROVIDER_PAGE_LIMIT,
  options: { enabled?: boolean } = {},
) {
  const query = useQuery({
    queryKey: [...ROOT_KEY, "webinars", limit],
    queryFn: ({ signal }) => fetchMyWebinars(limit, 0, signal),
    enabled: options.enabled ?? true,
    staleTime: 30_000,
  });

  const refetch = useCallback(() => query.refetch(), [query]);

  return {
    webinars: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch,
  };
}

function useInvalidateDashboard() {
  const queryClient = useQueryClient();

  return useCallback(() => queryClient.invalidateQueries({ queryKey: ROOT_KEY }), [queryClient]);
}

export function useCreateProvider() {
  const invalidate = useInvalidateDashboard();

  return useMutation({
    mutationFn: (input: CreateProviderInput) => createMyProvider(input),
    onSuccess: () => invalidate(),
  });
}

export function useCreateCourse() {
  const invalidate = useInvalidateDashboard();

  return useMutation({
    mutationFn: (input: CreateCourseInput) => createCourse(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateCourse() {
  const invalidate = useInvalidateDashboard();

  return useMutation({
    mutationFn: ({ courseId, changes }: { courseId: string; changes: UpdateCourseInput }) =>
      updateCourse(courseId, changes),
    onSuccess: () => invalidate(),
  });
}

export function useCreateWebinar() {
  const invalidate = useInvalidateDashboard();

  return useMutation({
    mutationFn: (input: CreateWebinarInput) => createWebinar(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateWebinar() {
  const invalidate = useInvalidateDashboard();

  return useMutation({
    mutationFn: ({ webinarId, changes }: { webinarId: string; changes: UpdateWebinarInput }) =>
      updateWebinar(webinarId, changes),
    onSuccess: () => invalidate(),
  });
}
