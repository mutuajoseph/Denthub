import { useMemo } from "react";
import { getBrandName } from "../config/regions";
import { getStaticSubdivisions } from "../config/subdivisions";
import { useCountryConfigStore } from "../store/countryConfigStore";
import { useRegionStore } from "../store/regionStore";
import {
  type Geography,
  getSubdivisionPlural,
  patchTrustBadges,
  subdivisionTrustBadge,
} from "../utils/subdivisionCopy";

export function useRegion() {
  const region = useRegionStore((s) => s.getRegion());
  const config = useCountryConfigStore((s) => s.config);
  const brandName = getBrandName(region);
  const setRegion = useRegionStore((s) => s.setRegion);
  const regionCode = useRegionStore((s) => s.regionCode) || region.code;
  const countiesLabel = config?.geography?.subdivisionLabel || region.countiesLabel || "Region";

  const geography = useMemo(
    (): Geography => ({
      subdivisionLabel: countiesLabel,
      subdivisionPlural:
        config?.geography?.subdivisionPlural ||
        getSubdivisionPlural({ subdivisionLabel: countiesLabel }),
    }),
    [countiesLabel, config?.geography?.subdivisionPlural],
  );

  const code = regionCode === "GLOBAL" ? "KE" : regionCode;
  const storeRegions = useCountryConfigStore.getState().regions;
  const subdivisionCount =
    storeRegions?.length > 0 ? storeRegions.length : getStaticSubdivisions(code).length;

  const trustBadges = useMemo(
    () => patchTrustBadges(region.trustBadges, subdivisionCount, geography),
    [region.trustBadges, subdivisionCount, geography],
  );

  return {
    region: {
      ...region,
      countiesLabel,
      trustBadges,
      subdivisionTrustBadge: subdivisionTrustBadge(subdivisionCount, geography),
    },
    regionCode,
    brandName,
    brandShort: region.brandSuffix ? region.brandSuffix : "Global",
    setRegion,
    currency: config?.currency || region.currency,
    currencySymbol: config?.currencySymbol || region.currencySymbol,
    locale: config?.locale || region.locale,
    countryName: region.countryName,
    flag: region.flag,
    countiesLabel,
    subdivisionCount,
    subdivisionPlural: geography.subdivisionPlural || getSubdivisionPlural(geography),
    trustBadges,
  };
}
