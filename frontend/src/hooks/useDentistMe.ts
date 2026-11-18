import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../lib/apiClient";
import {
  type MySpecialist,
  type MySpecialistCreate,
  type MySpecialistUpdate,
  createMySpecialist,
  fetchMySpecialist,
  updateMySpecialist,
} from "../lib/dentistMeApi";

export const mySpecialistQueryKey = (userId: string | null) => ["my-specialist", userId] as const;

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

export function useMySpecialist(userId: string | null, enabled: boolean) {
  return useQuery<MySpecialist>({
    queryKey: mySpecialistQueryKey(userId),
    queryFn: ({ signal }) => fetchMySpecialist({ signal }),
    enabled: userId !== null && enabled,
    retry: (failureCount, error) => !isNotFound(error) && failureCount < 1,
  });
}

function useListingInvalidation(userId: string | null) {
  const queryClient = useQueryClient();

  return (specialist: MySpecialist) => {
    queryClient.setQueryData(mySpecialistQueryKey(userId), specialist);
    void queryClient.invalidateQueries({ queryKey: mySpecialistQueryKey(userId) });
    void queryClient.invalidateQueries({ queryKey: ["listing-detail"] });
    void queryClient.invalidateQueries({ queryKey: ["listing-search"] });
    void queryClient.invalidateQueries({ queryKey: ["home-featured"] });
    void queryClient.invalidateQueries({ queryKey: ["home-stats"] });
  };
}

export function useCreateMySpecialist(userId: string | null) {
  const onSuccess = useListingInvalidation(userId);

  return useMutation({
    mutationFn: (data: MySpecialistCreate) => createMySpecialist(data),
    onSuccess,
  });
}

export function useUpdateMySpecialist(userId: string | null) {
  const onSuccess = useListingInvalidation(userId);

  return useMutation({
    mutationFn: (data: MySpecialistUpdate) => updateMySpecialist(data),
    onSuccess,
  });
}
