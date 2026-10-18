import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type HealthRecordEntryRequest,
  type HealthRecordView,
  type HealthRecordWire,
  type MaternalStatus,
  addHealthRecordEntry,
  fetchHealthRecord,
  mapHealthRecord,
  updateHealthRecord,
} from "../lib/healthRecordApi";

/**
 * The record key carries the Patient id: the request reads the bearer token and
 * the path, so a different account on the same browser must not be served
 * another Patient's record. It carries no country — a Health Record is a
 * portability model and spans every market the Patient was treated in.
 */
export const healthRecordQueryKey = (patientId: string) => ["health-record", patientId] as const;

export function useHealthRecord(patientId: string) {
  const query = useQuery<HealthRecordWire, Error, HealthRecordView>({
    queryKey: healthRecordQueryKey(patientId),
    queryFn: ({ signal }) => fetchHealthRecord(patientId, { signal }),
    select: mapHealthRecord,
    staleTime: 30_000,
  });

  return {
    record: query.data ?? null,
    isLoading: query.isPending,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useAddHealthRecordEntry(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: HealthRecordEntryRequest) => addHealthRecordEntry(patientId, request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: healthRecordQueryKey(patientId) });
    },
  });
}

export function useUpdateMaternalStatus(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (maternalStatus: MaternalStatus) =>
      updateHealthRecord(patientId, { maternal_status: maternalStatus }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: healthRecordQueryKey(patientId) });
    },
  });
}
