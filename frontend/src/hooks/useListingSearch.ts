import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { type DentistListing, fetchListingSearch, mapListing } from "../lib/listingApi";
import type { ListingTypeFilter } from "../lib/listingSearch";
import { useSpecialties } from "./useSpecialties";

export interface ListingSearchInput {
  /** The market being asked about — `apiCountry`, never `GLOBAL`. */
  country: string;
  /** Server-side filter; the request's own input, echoed in the query key. */
  subdivisionCode?: string;
  /** Which endpoints to hit; also echoed in the key so a switch refetches. */
  listingType?: ListingTypeFilter;
}

/**
 * The market's listings as `ListingView`s: facilities, specialists, or both.
 *
 * One query fetches the endpoints in parallel; text, specialty, rating, open
 * status, and sort are applied in memory by `lib/listingSearch` (#18's market
 * strategy — server-side search past 100 rows is a follow-up issue).
 * `placeholderData` keeps the previous market visible while a region or
 * subdivision switch loads, so the grid never flashes empty.
 */
export function useListingSearch({
  country,
  subdivisionCode,
  listingType = "all",
}: ListingSearchInput) {
  const { nameOf } = useSpecialties();

  const query = useQuery<DentistListing[]>({
    queryKey: ["listing-search", country, subdivisionCode ?? "", listingType],
    queryFn: ({ signal }) => fetchListingSearch({ country, subdivisionCode, listingType }, signal),
    placeholderData: (previous) => previous,
  });

  const listings = useMemo(
    () => (query.data ?? []).map((wire) => mapListing(wire, nameOf)),
    [query.data, nameOf],
  );

  return {
    listings,
    isLoading: query.isPending,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
