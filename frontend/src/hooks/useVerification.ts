import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  type DecideVerificationRequest,
  type SubmitVerificationRequest,
  decideAdminVerification,
  decideDivisionVerification,
  fetchAdminVerifications,
  fetchDivisionVerifications,
  fetchMyVerifications,
  submitVerification,
} from "../lib/verificationApi";

export const verificationQueryKey = (section: string, userId: string | null) =>
  ["verification", section, userId] as const;

function invalidateDecisions(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["verification"] });
  void queryClient.invalidateQueries({ queryKey: ["admin", "audit"] });
  void queryClient.invalidateQueries({ queryKey: ["operations"] });
  void queryClient.invalidateQueries({ queryKey: ["listing-detail"] });
}

export function useMyVerifications(userId: string | null) {
  return useQuery({
    queryKey: verificationQueryKey("mine", userId),
    queryFn: async ({ signal }) => (await fetchMyVerifications({ signal })).items,
    enabled: userId !== null,
    staleTime: 15_000,
  });
}

export function useSubmitVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SubmitVerificationRequest) => submitVerification(data),
    onSuccess: () => invalidateDecisions(queryClient),
  });
}

export function useVerificationApplications(userId: string | null) {
  return useQuery({
    queryKey: verificationQueryKey("admin", userId),
    queryFn: async ({ signal }) => (await fetchAdminVerifications({ signal })).items,
    enabled: userId !== null,
    staleTime: 15_000,
  });
}

export function useDivisionVerificationApplications(userId: string | null) {
  return useQuery({
    queryKey: verificationQueryKey("division", userId),
    queryFn: async ({ signal }) => (await fetchDivisionVerifications({ signal })).items,
    enabled: userId !== null,
    staleTime: 15_000,
  });
}

export function useAdminVerificationDecision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      applicationId,
      decision,
      request,
    }: {
      applicationId: string;
      decision: "approve" | "reject" | "revoke";
      request: DecideVerificationRequest;
    }) => decideAdminVerification(applicationId, decision, request.reason),
    onSuccess: () => invalidateDecisions(queryClient),
  });
}

export function useDivisionVerificationDecision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      applicationId,
      decision,
      request,
    }: {
      applicationId: string;
      decision: "approve" | "reject" | "revoke";
      request: DecideVerificationRequest;
    }) => decideDivisionVerification(applicationId, decision, request.reason),
    onSuccess: () => invalidateDecisions(queryClient),
  });
}
