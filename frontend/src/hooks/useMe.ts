import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthUser, ProfileKind } from "../lib/auth";
import { type MeUpdate, addProfile, fetchMe, updateMe } from "../lib/meApi";

export const meQueryKey = (userId: string | null) => ["me", userId] as const;

export function useMe(userId: string | null) {
  return useQuery<AuthUser>({
    queryKey: meQueryKey(userId),
    queryFn: ({ signal }) => fetchMe({ signal }),
    enabled: userId !== null,
  });
}

export function useUpdateMe(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: MeUpdate) => updateMe(data),
    onSuccess: (user) => {
      queryClient.setQueryData(meQueryKey(userId), user);
    },
  });
}

export function useAddProfile(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (kind: ProfileKind) => addProfile(kind),
    onSuccess: (user) => {
      queryClient.setQueryData(meQueryKey(userId), user);
    },
  });
}
