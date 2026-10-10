import { useQuery } from "@tanstack/react-query";
import { useRegionStore } from "../store/regionStore";

import {
  type MagazineArticleDetail,
  type MagazineCategoryList,
  type MagazinePage,
  fetchMagazineArticle,
  fetchMagazineArticles,
  fetchMagazineCategories,
} from "../lib/magazineApi";

/** The board fetches one page and filters in the client. Backend caps at 100. */
export const MAGAZINE_PAGE_LIMIT = 100;

function useActiveCountryCode(): string {
  const regionCode = useRegionStore((state) => state.regionCode || state.getRegion().code);
  // GLOBAL is a display-only region; the API always resolves to a real country.
  return regionCode === "GLOBAL" ? "KE" : regionCode;
}

/**
 * Every published item in the active market, newest first.
 *
 * `placeholderData` keeps the previous list visible while a region switch
 * refetches, so a country change does not flash an empty grid.
 */
export function useMagazineArticles() {
  const countryCode = useActiveCountryCode();

  const query = useQuery<MagazinePage>({
    queryKey: ["magazine", "articles", countryCode],
    queryFn: ({ signal }) => fetchMagazineArticles({ limit: MAGAZINE_PAGE_LIMIT }, signal),
    placeholderData: (previous) => previous,
    staleTime: 60 * 1000,
  });

  return {
    articles: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isPending,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

/** Categories of published articles in the active market. */
export function useMagazineCategories() {
  const countryCode = useActiveCountryCode();

  const query = useQuery<MagazineCategoryList>({
    queryKey: ["magazine", "categories", countryCode],
    queryFn: ({ signal }) => fetchMagazineCategories(signal),
    staleTime: 5 * 60 * 1000,
  });

  return {
    categories: query.data?.categories ?? [],
    isLoading: query.isPending,
    error: query.error,
  };
}

/** One full article by slug; the detail endpoint is the only source of `body`. */
export function useArticleDetail(slug: string) {
  const countryCode = useActiveCountryCode();

  const query = useQuery<MagazineArticleDetail>({
    queryKey: ["magazine", "article", countryCode, slug],
    queryFn: ({ signal }) => fetchMagazineArticle(slug, signal),
    enabled: slug !== "",
    staleTime: 60 * 1000,
  });

  return {
    article: query.data,
    isLoading: query.isPending,
    error: query.error,
  };
}
