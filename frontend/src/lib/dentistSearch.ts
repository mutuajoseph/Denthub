import { DENTIST_FIXTURES, type DentistListing, type DentistListingType } from "./dentistFixtures";

export type DentistSearchSort =
  | "rating"
  | "rating_asc"
  | "rating_desc"
  | "price"
  | "price_asc"
  | "price_desc"
  | "reviews"
  | "reviews_asc"
  | "reviews_desc"
  | "name"
  | "name_asc"
  | "name_desc";

export type DentistSort = DentistSearchSort;
export type StringFilter = string | readonly string[];

export interface DentistSearchFilters {
  readonly query?: string;
  readonly country?: string;
  readonly countryCode?: string;
  readonly subdivision?: string;
  readonly region?: string;
  readonly listingType?: DentistListingType | "all";
  readonly specialty?: StringFilter;
  readonly specialties?: readonly string[];
  readonly insurance?: StringFilter;
  readonly insurancePanel?: string;
  readonly minRating?: number;
  readonly openNow?: boolean;
  readonly sort?: DentistSearchSort;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function filterValues(value: StringFilter | undefined): string[] {
  if (!value) return [];
  if (typeof value === "string") return value.trim() ? [value] : [];
  return value.filter((item) => item.trim().length > 0);
}

function matchesTextQuery(listing: DentistListing, query: string): boolean {
  const terms = normalizeText(query).split(" ").filter(Boolean);
  if (terms.length === 0) return true;

  const searchableText = normalizeText(
    [
      listing.name,
      listing.clinic ?? "",
      ...listing.specialties,
      listing.location.subdivision,
      listing.location.city,
      ...listing.location.operatingAreas,
      listing.insurance.nationalScheme ?? "",
      ...listing.insurance.accepted,
      listing.hours.summary,
    ].join(" "),
  );

  return terms.every((term) => searchableText.includes(term));
}

function matchesTextFilter(
  values: StringFilter | undefined,
  candidates: readonly (string | null)[],
): boolean {
  const filters = filterValues(values);
  if (filters.length === 0) return true;

  const normalizedCandidates = candidates
    .filter((candidate): candidate is string => candidate !== null)
    .map(normalizeText);

  return filters.some((filter) => {
    const normalizedFilter = normalizeText(filter);
    return normalizedCandidates.some((candidate) => candidate.includes(normalizedFilter));
  });
}

function matchesListingType(
  listing: DentistListing,
  requestedType: DentistListingType | "all" | undefined,
): boolean {
  if (!requestedType || requestedType === "all") return true;
  return listing.listingType === requestedType;
}

function matchesSpecialties(listing: DentistListing, filters: DentistSearchFilters): boolean {
  const requested = [...filterValues(filters.specialty), ...filterValues(filters.specialties)];
  if (requested.length === 0) return true;

  const specialties = listing.specialties.map(normalizeText);
  return requested.some((specialty) => {
    const normalizedSpecialty = normalizeText(specialty);
    return specialties.some((listingSpecialty) => listingSpecialty.includes(normalizedSpecialty));
  });
}

function matchesCountry(listing: DentistListing, filters: DentistSearchFilters): boolean {
  const requested = filters.countryCode ?? filters.country;
  if (!requested) return true;
  const normalizedCountry = requested.trim().toUpperCase();
  if (!normalizedCountry || normalizedCountry === "GLOBAL") return true;
  return listing.location.countryCode === normalizedCountry;
}

function matchesMinRating(listing: DentistListing, minimum: number | undefined): boolean {
  if (minimum === undefined || !Number.isFinite(minimum)) return true;
  return listing.rating >= minimum;
}

function filterMatches(listing: DentistListing, filters: DentistSearchFilters): boolean {
  return (
    matchesTextQuery(listing, filters.query ?? "") &&
    matchesCountry(listing, filters) &&
    matchesTextFilter(filters.subdivision ?? filters.region, [
      listing.location.subdivision,
      listing.location.city,
      ...listing.location.operatingAreas,
    ]) &&
    matchesListingType(listing, filters.listingType) &&
    matchesSpecialties(listing, filters) &&
    matchesTextFilter(filters.insurance ?? filters.insurancePanel, [
      listing.insurance.nationalScheme,
      ...listing.insurance.accepted,
    ]) &&
    matchesMinRating(listing, filters.minRating) &&
    (filters.openNow !== true || listing.hours.openNow)
  );
}

export function filterDentistListings(
  listings: readonly DentistListing[],
  filters: DentistSearchFilters = {},
): readonly DentistListing[] {
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

function compareNumber(left: number, right: number, direction: 1 | -1): number {
  if (left < right) return -direction;
  if (left > right) return direction;
  return 0;
}

type SortMode = "rating" | "price" | "reviews" | "name";
type SortDirection = "asc" | "desc";

function resolveSort(sort: DentistSearchSort): [SortMode, SortDirection] {
  if (sort === "rating_asc") return ["rating", "asc"];
  if (sort === "rating_desc" || sort === "rating") return ["rating", "desc"];
  if (sort === "price_asc" || sort === "price") return ["price", "asc"];
  if (sort === "price_desc") return ["price", "desc"];
  if (sort === "reviews_asc") return ["reviews", "asc"];
  if (sort === "reviews_desc" || sort === "reviews") return ["reviews", "desc"];
  if (sort === "name_desc") return ["name", "desc"];
  return ["name", "asc"];
}

function compareListings(
  left: DentistListing,
  right: DentistListing,
  mode: SortMode,
  direction: SortDirection,
): number {
  const numericDirection: 1 | -1 = direction === "asc" ? 1 : -1;
  let primary = 0;

  if (mode === "rating") primary = compareNumber(left.rating, right.rating, numericDirection);
  if (mode === "price") {
    primary = compareNumber(left.pricing.amount, right.pricing.amount, numericDirection);
  }
  if (mode === "reviews") {
    primary = compareNumber(left.reviewCount, right.reviewCount, numericDirection);
  }
  if (mode === "name") {
    primary = compareText(left.name, right.name);
    if (direction === "desc") primary *= -1;
  }

  if (primary !== 0) return primary;
  return compareText(left.name, right.name) || compareText(left.id, right.id);
}

export function sortDentistListings(
  listings: readonly DentistListing[],
  sort: DentistSearchSort = "rating_desc",
): readonly DentistListing[] {
  const [mode, direction] = resolveSort(sort);
  return listings.slice().sort((left, right) => compareListings(left, right, mode, direction));
}

export function searchDentistListings(
  filters: DentistSearchFilters = {},
  listings: readonly DentistListing[] = DENTIST_FIXTURES,
): readonly DentistListing[] {
  return sortDentistListings(filterDentistListings(listings, filters), filters.sort);
}
