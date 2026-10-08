/**
 * The pure search surface behind Find Dentist and Emergency.
 *
 * The market's listings arrive from `listingApi.fetchListingSearch` and this
 * module filters/sorts them in memory — the client-side half of #18's market
 * strategy (server-side search past 100 rows is a follow-up issue). Inputs a
 * request already read (country, subdivision, listing type) are echoed here
 * only where the card list needs them anyway; specialty, text, rating, open
 * status, and sort never reach the network.
 */

import type { ListingType, ListingView } from "./listingApi";

export type ListingSort =
  | "rating_desc"
  | "rating_asc"
  | "reviews_desc"
  | "reviews_asc"
  | "name_asc"
  | "name_desc";

export type ListingTypeFilter = ListingType | "all";

export interface ListingSearchFilters {
  /** Free text over name, workplace, specialty names, and location codes. */
  query?: string;
  listingType?: ListingTypeFilter;
  /** A specialty **code**, matched exactly against `specialtyCodes`. */
  specialty?: string;
  minRating?: number;
  openNow?: boolean;
  sort?: ListingSort;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function matchesTextQuery(listing: ListingView, query: string): boolean {
  const terms = normalizeText(query).split(" ").filter(Boolean);
  if (terms.length === 0) return true;

  const searchableText = normalizeText(
    [
      listing.name,
      listing.clinic ?? "",
      ...listing.specialties,
      listing.subdivisionCode,
      listing.countryCode,
    ].join(" "),
  );

  return terms.every((term) => searchableText.includes(term));
}

function filterMatches(listing: ListingView, filters: ListingSearchFilters): boolean {
  if (!matchesTextQuery(listing, filters.query ?? "")) return false;

  if (filters.listingType && filters.listingType !== "all") {
    if (listing.listingType !== filters.listingType) return false;
  }

  if (filters.specialty && !listing.specialtyCodes.includes(filters.specialty)) return false;

  // `0` is the "Any" position of the rating slider, not a real minimum.
  if (
    filters.minRating !== undefined &&
    filters.minRating > 0 &&
    Number.isFinite(filters.minRating)
  ) {
    if (listing.rating === null || listing.rating < filters.minRating) return false;
  }

  if (filters.openNow === true && !listing.openNow) return false;

  return true;
}

export function filterListings(
  listings: readonly ListingView[],
  filters: ListingSearchFilters = {},
): ListingView[] {
  return listings.filter((listing) => filterMatches(listing, filters));
}

function compareText(left: string, right: string): number {
  const normalizedLeft = normalizeText(left);
  const normalizedRight = normalizeText(right);
  if (normalizedLeft < normalizedRight) return -1;
  if (normalizedLeft > normalizedRight) return 1;
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** Orders a pair of optional numbers with `null` always last, whatever the direction. */
function compareOptionalNumber(
  left: number | null,
  right: number | null,
  direction: 1 | -1,
): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  if (left < right) return -direction;
  if (left > right) return direction;
  return 0;
}

function compareNumber(left: number, right: number, direction: 1 | -1): number {
  if (left < right) return -direction;
  if (left > right) return direction;
  return 0;
}

function compareBySort(left: ListingView, right: ListingView, sort: ListingSort): number {
  switch (sort) {
    case "rating_asc":
      return compareOptionalNumber(left.rating, right.rating, 1);
    case "reviews_desc":
      return compareNumber(left.reviewCount, right.reviewCount, -1);
    case "reviews_asc":
      return compareNumber(left.reviewCount, right.reviewCount, 1);
    case "name_asc":
      return compareText(left.name, right.name);
    case "name_desc":
      return -compareText(left.name, right.name);
    default:
      return compareOptionalNumber(left.rating, right.rating, -1);
  }
}

export function sortListings(
  listings: readonly ListingView[],
  sort: ListingSort = "rating_desc",
): ListingView[] {
  return listings
    .slice()
    .sort(
      (left, right) =>
        compareBySort(left, right, sort) ||
        compareText(left.name, right.name) ||
        compareText(left.id, right.id),
    );
}

/** Filter, then sort: the whole in-memory search in one call. */
export function searchListings(
  filters: ListingSearchFilters = {},
  listings: readonly ListingView[] = [],
): ListingView[] {
  return sortListings(filterListings(listings, filters), filters.sort);
}
