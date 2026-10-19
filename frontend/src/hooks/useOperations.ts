import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  type DivisionJobWire,
  type JobStatus,
  type OperationsOverviewWire,
  fetchDivisionJobs,
  fetchOperationsOverview,
  setDivisionJobStatus,
} from "../lib/operationsApi";

/**
 * Every operations read is keyed by the signed-in user id. The request reads
 * the bearer token, so another Operator on the same browser must not be served
 * the previous account's Division. The console is Division-scoped, not
 * country-scoped; the country the Operator happens to browse does not change
 * the queue.
 */
export const operationsQueryKey = (section: string, userId: string | null) =>
  ["operations", section, userId] as const;

export function useOperationsOverview(userId: string | null) {
  return useQuery<OperationsOverviewWire>({
    queryKey: operationsQueryKey("overview", userId),
    queryFn: async ({ signal }) => await fetchOperationsOverview({ signal }),
    enabled: userId !== null,
    staleTime: 30_000,
  });
}

export function useDivisionJobs(userId: string | null) {
  return useQuery<DivisionJobWire[]>({
    queryKey: operationsQueryKey("jobs", userId),
    queryFn: async ({ signal }) => (await fetchDivisionJobs({ signal })).items,
    enabled: userId !== null,
    staleTime: 15_000,
  });
}

export function useSetJobStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postingId, status }: { postingId: string; status: JobStatus }) =>
      setDivisionJobStatus(postingId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["operations", "jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}
