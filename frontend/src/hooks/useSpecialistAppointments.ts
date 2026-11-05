import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { type AppointmentWire, fetchSpecialistAppointments } from "../lib/appointmentApi";
import { type FacilityAppointmentStatus, updateFacilityAppointment } from "../lib/facilityApi";

export const specialistAppointmentsQueryKey = (userId: string | null) =>
  ["appointments", "specialist", userId] as const;

export function useSpecialistAppointments(userId: string | null) {
  const query = useQuery<AppointmentWire[]>({
    queryKey: specialistAppointmentsQueryKey(userId),
    queryFn: ({ signal }) => fetchSpecialistAppointments({ signal }),
    enabled: userId !== null,
    staleTime: 30_000,
  });
  return {
    items: query.data ?? [],
    isLoading: userId !== null && query.isPending,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useAdvanceSpecialistAppointment(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      appointmentId,
      status,
    }: { appointmentId: string; status: FacilityAppointmentStatus }) =>
      updateFacilityAppointment(appointmentId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: specialistAppointmentsQueryKey(userId) });
    },
  });
}
