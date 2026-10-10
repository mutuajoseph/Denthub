import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ApiError } from "../lib/apiClient";
import {
  type FacilityDetail,
  type ListingType,
  type SpecialistDetail,
  fetchFacilityDetail,
  fetchSpecialistDetail,
  mapProfile,
} from "../lib/listingApi";
import { useSpecialties } from "./useSpecialties";

type ProfileWire = FacilityDetail | SpecialistDetail;

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/**
 * One profile, resolving the type the route knows or the legacy typeless id.
 *
 * A Facility id and a Specialist id live in different tables, so a typeless
 * link (the shape every pre-#24 home card still hands out) asks for a clinic
 * first and falls back to a specialist on 404. Not-found on both is `null`
 * data — a state the page renders, not a failed query.
 */
async function fetchProfile(
  listingType: ListingType | null,
  id: string,
  signal?: AbortSignal,
): Promise<ProfileWire | null> {
  if (listingType !== null) {
    try {
      return listingType === "facility"
        ? await fetchFacilityDetail(id, signal)
        : await fetchSpecialistDetail(id, signal);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  try {
    return await fetchFacilityDetail(id, signal);
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }

  try {
    return await fetchSpecialistDetail(id, signal);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

/**
 * A profile page for `listingType`/`id`, mapped to `ListingProfileView`.
 *
 * `listingType: null` is the legacy typeless route (`/dentists/:id`,
 * `/dentist/:id`); the query key names that mode so it never serves a cached
 * facility result to a typed specialist URL.
 *
 * The key carries no country: the detail routes accept the market for parity
 * but the listing's own Country governs the response, so a region switch never
 * changes what a deep link reads.
 */
export function useListingDetail(listingType: ListingType | null, id: string) {
  const { nameOf } = useSpecialties();

  const query = useQuery<ProfileWire | null>({
    queryKey: ["listing-detail", listingType ?? "any", id],
    queryFn: ({ signal }) => fetchProfile(listingType, id, signal),
    enabled: id !== "",
  });

  const profile = useMemo(
    () => (query.data ? mapProfile(query.data, nameOf) : null),
    [query.data, nameOf],
  );

  return {
    profile,
    isLoading: query.isPending,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
