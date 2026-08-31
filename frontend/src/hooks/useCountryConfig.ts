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
  const adaptation = useCountryConfigStore((s) => s.adaptation);
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

  const subdivisionLabel =
    config?.geography?.subdivisionLabel ||
    adaptation?.subdivisionLabel ||
    countiesLabel ||
    "Region";

  const mergedRegions = regions.length > 0 ? regions : getStaticSubdivisions(apiCountry);

  const geography = {
    subdivisionLabel: config?.geography?.subdivisionLabel || countiesLabel,
    subdivisionPlural:
      config?.geography?.subdivisionPlural ||
      adaptation?.subdivisionPlural ||
      getSubdivisionPlural({ subdivisionLabel: countiesLabel }),
  };

  const subdivisionCount = mergedRegions.length;
  const subdivisionPlural = getSubdivisionPlural(geography);

  const insuranceProviders =
    adaptation?.insuranceProviders ||
    config?.featureContexts?.DENTAL_INSURANCE?.insuranceProviders ||
    [];

  const featureContexts = config?.featureContexts || {};

  const insuranceSchemeLabel =
    apiCountry === "NG"
      ? "NHIS"
      : apiCountry === "KE"
        ? "NHIF"
        : apiCountry === "IN"
          ? "PM-JAY"
          : apiCountry === "TR"
            ? "SGK"
            : config?.featureConfigs?.DENTAL_INSURANCE?.primaryScheme || "Insurance";

  return {
    apiCountry,
    config,
    adaptation,
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
    insuranceSchemeLabel,
  };
}
