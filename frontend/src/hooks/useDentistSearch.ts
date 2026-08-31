import { useQuery } from "@tanstack/react-query";
import { SPECIALTIES } from "../config/dentistConstants";
import { subdivisionToSearchParams } from "../config/subdivisions";
import {
  type DentistCard,
  type PracticeCard,
  USE_API,
  searchClinics,
  searchDentists,
} from "../lib/searchApi";
import { useCountryConfig } from "./useCountryConfig";

export interface SearchFilters {
  subdivisionValue?: string;
  subdivisionOptions?: { id: string; name: string }[];
  sort?: string;
  nhifOnly?: boolean;
  insurancePanel?: string;
  minRating?: number;
  openNow?: boolean;
  specialties?: string[];
}

export interface SearchResult {
  specialists: DentistCard[];
  practices: PracticeCard[];
  regions: { id?: string; name?: string }[];
  specialties: string[];
  fromApi: boolean;
}

export function useDentistSearch(filters: SearchFilters = {}) {
  const { apiCountry, regions } = useCountryConfig();

  const geoParams = subdivisionToSearchParams(
    filters.subdivisionValue,
    filters.subdivisionOptions || regions,
  );

  const searchParams = {
    countryCode: apiCountry,
    page: 1,
    limit: 50,
    sortBy: "rating_desc",
    ...geoParams,
    acceptsNhif: filters.nhifOnly || undefined,
    insurancePanel: filters.insurancePanel || undefined,
    minRating: filters.minRating || undefined,
    isOpenNow: filters.openNow || undefined,
    specialties: filters.specialties?.length ? filters.specialties : undefined,
  };

  return useQuery<SearchResult>({
    queryKey: ["search", "dentists-practices", apiCountry, filters, geoParams],
    enabled: USE_API && Boolean(apiCountry),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      try {
        const [dentistResult, clinicResult] = await Promise.all([
          searchDentists(searchParams),
          searchClinics(searchParams),
        ]);

        return {
          specialists: dentistResult.specialists,
          practices: clinicResult.practices,
          regions: [],
          specialties: SPECIALTIES,
          fromApi: true,
        };
      } catch (err) {
        const status = (err as { status?: number }).status;
        const offline =
          status === undefined ||
          status === 404 ||
          status === 502 ||
          status === 503 ||
          status >= 500;
        if (!offline) throw err;
        return {
          specialists: [],
          practices: [],
          regions: [],
          specialties: SPECIALTIES,
          fromApi: false,
        };
      }
    },
    retry: (count, err) => {
      const status = (err as { status?: number }).status;
      if (status === 404 || status === 502 || status === 503) return false;
      return count < 1;
    },
  });
}
