import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  type AdminAuditListWire,
  type AdminCountryFeatureWire,
  type AdminCountryWire,
  type ModerationItemWire,
  type ModerationStatus,
  type VerificationItemWire,
  type VerificationTier,
  fetchAdminAudit,
  fetchAdminCountries,
  fetchAdminModeration,
  fetchAdminVerifications,
  moderateJob,
  moderateMagazine,
  setFacilityVerificationTier,
  setSpecialistVerificationTier,
  updateCountry,
  updateCountryFeature,
} from "../lib/adminApi";
import { useCountryConfigStore } from "../store/countryConfigStore";

/**
 * Every admin read is keyed by the signed-in user id. The requests read the
 * bearer token, so another administrator on the same browser must not be served
 * the previous account's view. The console's data is platform-wide, not
 * country-scoped; country changes are writes, not query inputs.
 */
export const adminQueryKey = (section: string, userId: string | null) =>
  ["admin", section, userId] as const;

function refreshActiveCountry(code: string | null | undefined) {
  if (!code) return;

  const store = useCountryConfigStore.getState();

  if (store.lastCountry === code) {
    void store.loadForCountry(code);
  }
}

export function useAdminCountries(userId: string | null) {
  return useQuery<AdminCountryWire[]>({
    queryKey: adminQueryKey("countries", userId),
    queryFn: async ({ signal }) => (await fetchAdminCountries({ signal })).items,
    enabled: userId !== null,
    staleTime: 30_000,
  });
}

export function useUpdateCountry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ code, isActive }: { code: string; isActive: boolean }) =>
      updateCountry(code, isActive),
    onSuccess: (country: AdminCountryWire) => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "countries"] });
      void queryClient.invalidateQueries({ queryKey: ["countries"] });
      refreshActiveCountry(country.code);
    },
  });
}

export function useUpdateCountryFeature() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      code,
      feature,
      isEnabled,
      primaryScheme,
    }: {
      code: string;
      feature: string;
      isEnabled: boolean;
      primaryScheme: string | null;
    }) =>
      updateCountryFeature(code, feature, {
        is_enabled: isEnabled,
        primary_scheme: primaryScheme,
      }),
    onSuccess: (_flag: AdminCountryFeatureWire, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "countries"] });
      void queryClient.invalidateQueries({ queryKey: ["countries"] });
      refreshActiveCountry(variables.code);
    },
  });
}

export function useAdminVerifications(userId: string | null) {
  return useQuery<{ items: VerificationItemWire[]; tiers: string[] }>({
    queryKey: adminQueryKey("verifications", userId),
    queryFn: async ({ signal }) => {
      const data = await fetchAdminVerifications({ signal });
      return { items: data.items, tiers: data.tiers };
    },
    enabled: userId !== null,
    staleTime: 30_000,
  });
}

export function useSetVerificationTier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      entityType,
      entityId,
      tier,
    }: {
      entityType: VerificationItemWire["entity_type"];
      entityId: string;
      tier: VerificationTier;
    }) =>
      entityType === "facility"
        ? setFacilityVerificationTier(entityId, tier)
        : setSpecialistVerificationTier(entityId, tier),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "verifications"] });
      void queryClient.invalidateQueries({ queryKey: ["listing-search"] });
      void queryClient.invalidateQueries({ queryKey: ["listing-detail"] });
      void queryClient.invalidateQueries({ queryKey: ["home-featured"] });
      void queryClient.invalidateQueries({ queryKey: ["home-stats"] });
    },
  });
}

export function useAdminModeration(userId: string | null) {
  return useQuery<ModerationItemWire[]>({
    queryKey: adminQueryKey("moderation", userId),
    queryFn: async ({ signal }) => (await fetchAdminModeration({ signal })).items,
    enabled: userId !== null,
    staleTime: 15_000,
  });
}

export function useModerateContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      entityType,
      entityId,
      status,
    }: {
      entityType: ModerationItemWire["entity_type"];
      entityId: string;
      status: ModerationStatus;
    }) =>
      entityType === "magazine"
        ? moderateMagazine(entityId, status)
        : moderateJob(entityId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "moderation"] });
      void queryClient.invalidateQueries({ queryKey: ["magazine"] });
      void queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export function useAdminAudit(userId: string | null) {
  return useQuery<AdminAuditListWire["items"]>({
    queryKey: adminQueryKey("audit", userId),
    queryFn: async ({ signal }) => (await fetchAdminAudit({ signal })).items,
    enabled: userId !== null,
    staleTime: 15_000,
  });
}
