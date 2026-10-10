import { useRegionStore } from "../store/regionStore";

/**
 * The API's notion of the active country: the region code, but never `GLOBAL`.
 * `GLOBAL` is a display-only region; the API always resolves to a real country.
 */
export function useActiveCountryCode(): string {
  const regionCode = useRegionStore((state) => state.regionCode || state.getRegion().code);
  return regionCode === "GLOBAL" ? "KE" : regionCode;
}
