import { useEffect } from "react";
import { getStaticSubdivisions } from "../config/subdivisions";
import { useCountryConfigStore } from "../store/countryConfigStore";
import { useRegionStore } from "../store/regionStore";
import {
  getSubdivisionPlural,
  subdivisionTrustBadge,
  verifiedClinicsSubtitle,
} from "../utils/subdivisionCopy";
import { useRegion } from "./useRegion";

export function useCountryConfig() {
  const regionCode = useRegionStore((s) => s.regionCode || s.getRegion().code);
  const { countiesLabel } = useRegion();
  const config = useCountryConfigStore((s) => s.config);
  const regions = useCountryConfigStore((s) => s.regions);
  const loading = useCountryConfigStore((s) => s.loading);
  const regionsLoading = useCountryConfigStore((s) => s.regionsLoading);
  const error = useCountryConfigStore((s) => s.error);
  const loadForCountry = useCountryConfigStore((s) => s.loadForCountry);
  const isFeatureEnabled = useCountryConfigStore((s) => s.isFeatureEnabled);

  const apiCountry = regionCode === "GLOBAL" ? "KE" : regionCode;

  useEffect(() => {
    if (apiCountry && apiCountry !== "GLOBAL") {
      void loadForCountry(apiCountry);
    }
  }, [apiCountry, loadForCountry]);

  const geography = {
    subdivisionLabel: config?.geography.subdivisionLabel || countiesLabel,
    subdivisionPlural:
      config?.geography.subdivisionPlural ||
      getSubdivisionPlural({ subdivisionLabel: countiesLabel }),
  };

  const subdivisionLabel = geography.subdivisionLabel;
  // An empty API list means "this country has no subdivisions yet", not "still
  // loading" and not "here is a hardcoded list". The static list is only a
  // pre-request fallback.
  const mergedRegions = regions.length > 0 ? regions : getStaticSubdivisions(apiCountry);
  const subdivisionCount = mergedRegions.length;
  const subdivisionPlural = getSubdivisionPlural(geography);

  const insuranceProviders = config?.featureContexts.DENTAL_INSURANCE?.insuranceProviders ?? [];
  const featureContexts = config?.featureContexts ?? {};

  // The scheme is market data, not a chain of country codes in the client. A
  // market with no scheme configured shows a generic label.
  const insuranceSchemeLabel =
    config?.featureConfigs.DENTAL_INSURANCE?.primaryScheme ?? "Insurance";

  return {
    apiCountry,
    config,
    loading,
    regionsLoading,
    error,
    geography,
    subdivisionLabel,
    subdivisionPlural,
    subdivisionCount,
    verifiedClinicsSubtitle: verifiedClinicsSubtitle(subdivisionCount, geography),
    subdivisionTrustBadge: subdivisionTrustBadge(subdivisionCount, geography),
    regions: mergedRegions,
    insuranceProviders,
    featureContexts,
    isFeatureEnabled,
    insuranceEnabled: isFeatureEnabled("DENTAL_INSURANCE"),
    shopEnabled: isFeatureEnabled("ORAL_CARE_SHOP"),
    jobsEnabled: isFeatureEnabled("JOBS_BOARD"),
    trainingEnabled: isFeatureEnabled("CPD_TRAINING"),
    insuranceSchemeLabel,
  };
}
