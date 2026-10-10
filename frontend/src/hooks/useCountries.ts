import { useQuery } from "@tanstack/react-query";
import { type CountrySummaryWire, fetchCountries } from "../lib/countryConfigApi";

/**
 * Every active country, for region switchers and country combos.
 *
 * The list itself is not per-market (the `/config/countries` payload covers all
 * active markets), so a single global key serves it. `staleTime` keeps a region
 * switch from refetching the same list.
 */
export function useCountries() {
  const query = useQuery<CountrySummaryWire[]>({
    queryKey: ["countries"],
    queryFn: () => fetchCountries().then((wire) => wire.items),
    staleTime: 5 * 60 * 1000,
  });

  return {
    countries: query.data ?? [],
    isLoading: query.isPending,
    error: query.error,
  };
}
