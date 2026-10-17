import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type FacilityAppointmentStatus,
  type FacilityDashboardWire,
  fetchFacilityDashboard,
  updateFacilityAppointment,
} from "../lib/facilityApi";

/**
 * The query key carries the user id: the request reads the bearer token, and the
 * backend scopes the answer to the Facility that account is linked to, so a
 * different clinic on the same browser must not be served another clinic's day.
 */
export const facilityDashboardQueryKey = (userId: string | null) =>
  ["facility", "dashboard", userId] as const;

export function useFacilityDashboard(userId: string | null) {
  return useQuery<FacilityDashboardWire>({
    queryKey: facilityDashboardQueryKey(userId),
    queryFn: ({ signal }) => fetchFacilityDashboard({ signal }),
    enabled: userId !== null,
    staleTime: 15_000,
  });
}

export function useUpdateFacilityAppointment(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      appointmentId,
      status,
    }: {
      appointmentId: string;
      status: FacilityAppointmentStatus;
    }) => updateFacilityAppointment(appointmentId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: facilityDashboardQueryKey(userId) });
    },
  });
}
