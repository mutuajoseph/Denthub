import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  type HomeFeatured,
  type HomeStats,
  fetchHomeFeatured,
  fetchHomeStats,
} from "../lib/homeApi";
import { mapListing } from "../lib/listingApi";
import { useSpecialties } from "./useSpecialties";

/**
 * The market's headline numbers, straight from `/home/stats`.
 *
 * The query key carries the country, so a region switch starts a fresh query
 * for the new market instead of showing the previous market's count under the
 * new copy. There is no `placeholderData`: a stale figure from another country
 * is exactly the lie this endpoint exists to kill.
 */
export function useHomeStats(country: string) {
  return useQuery<HomeStats>({
    queryKey: ["home-stats", country],
    queryFn: ({ signal }) => fetchHomeStats(country, signal),
  });
}

/**
 * The market's featured cards, from `/home/featured`, as `ListingView`s.
 *
 * Same card model the directory renders, so a Home card and a search card
 * never disagree about what a listing is. The key carries the country, so a
 * region switch refetches; a caller renders nothing until the new market's
 * data lands rather than flash the old market's cards.
 */
export function useHomeFeatured(country: string) {
  const { nameOf } = useSpecialties();

  const query = useQuery<HomeFeatured>({
    queryKey: ["home-featured", country],
    queryFn: ({ signal }) => fetchHomeFeatured(country, signal),
  });

  const listings = useMemo(
    () => (query.data?.items ?? []).map((wire) => mapListing(wire, nameOf)),
    [query.data, nameOf],
  );

  return {
    listings,
    hasLoaded: query.data !== undefined,
    isPending: query.isPending,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
