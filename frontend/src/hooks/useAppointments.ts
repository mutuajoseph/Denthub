import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type AppointmentPageWire,
  type BookAppointmentRequest,
  DASHBOARD_APPOINTMENT_LIMIT,
  bookAppointment,
  fetchMyAppointments,
} from "../lib/appointmentApi";

/**
 * The list key carries the user id: the request reads the bearer token, not a
 * country or a cursor, so a different Patient on the same browser must not be
 * served another account's appointments. It carries no country — the endpoint
 * reads none, and a Patient's history spans markets anyway.
 */
export const appointmentsQueryKey = (userId: string | null) =>
  ["appointments", "mine", userId] as const;

export function useMyAppointments(userId: string | null) {
  const query = useQuery<AppointmentPageWire>({
    queryKey: appointmentsQueryKey(userId),
    queryFn: ({ signal }) => fetchMyAppointments({ limit: DASHBOARD_APPOINTMENT_LIMIT, signal }),
    enabled: userId !== null,
    staleTime: 30_000,
  });

  return {
    items: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    limit: query.data?.limit ?? 20,
    offset: query.data?.offset ?? 0,
    isLoading: userId !== null && query.isPending,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useBookAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: BookAppointmentRequest) => bookAppointment(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
  });
}
