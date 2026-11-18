import { useQuery } from "@tanstack/react-query";
import { type CountryConfig, fetchCountryConfig } from "../lib/countryConfigApi";

export function useCountrySubdivisions(countryCode: string | null) {
  return useQuery<CountryConfig>({
    queryKey: ["country-config", countryCode],
    queryFn: () => fetchCountryConfig(countryCode ?? undefined),
    enabled: countryCode !== null && countryCode !== "",
    staleTime: 5 * 60 * 1000,
  });
}
