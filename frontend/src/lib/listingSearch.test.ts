import { describe, expect, it } from "vitest";

import type { ListingView } from "./listingApi";
import { filterListings, searchListings, sortListings } from "./listingSearch";

function makeListing(
  overrides: Partial<ListingView> & Pick<ListingView, "id" | "name">,
): ListingView {
  return {
    listingType: "specialist",
    clinic: null,
    specialtyCodes: [],
    specialties: [],
    countryCode: "KE",
    subdivisionCode: "NAIROBI",
    rating: null,
    reviewCount: 0,
    amount: null,
    currency: "KES",
    openNow: false,
    phone: null,
    verificationTier: null,
    ...overrides,
  };
}

const WANJIKU = makeListing({
  id: "sp-1",
  name: "Dr. Wanjiku Kamau",
  specialties: ["General Dentistry"],
  rating: 4.5,
  reviewCount: 12,
  openNow: true,
});

const WESTLANDS = makeListing({
  id: "f-1",
  name: "Westlands Dental Implants Clinic",
  listingType: "facility",
  specialtyCodes: ["orthodontics"],
  specialties: ["Orthodontics"],
  subdivisionCode: "WESTLANDS",
  rating: 3.9,
  reviewCount: 3,
});

const ELDORET = makeListing({
  id: "f-2",
  name: "Eldoret Dental Hub",
  listingType: "facility",
  specialtyCodes: ["general-dentistry", "periodontics"],
  rating: null,
  reviewCount: 0,
});

const ALL = [WANJIKU, WESTLANDS, ELDORET];

describe("filterListings", () => {
  it("matches free text across names, workplace, and specialties", () => {
    expect(filterListings(ALL, { query: "wanjiku" }).map((l) => l.id)).toEqual(["sp-1"]);
    expect(filterListings(ALL, { query: "westlands implants" }).map((l) => l.id)).toEqual(["f-1"]);
    expect(filterListings(ALL, { query: "orthodontics" }).map((l) => l.id)).toEqual(["f-1"]);
  });

  it("matches location codes case-insensitively", () => {
    expect(filterListings(ALL, { query: "eldoret" }).map((l) => l.id)).toEqual(["f-2"]);
    expect(filterListings(ALL, { query: "nairobi" }).map((l) => l.id)).toEqual(["sp-1", "f-2"]);
  });

  it("keeps only the chosen listing type", () => {
    expect(filterListings(ALL, { listingType: "facility" }).map((l) => l.id)).toEqual([
      "f-1",
      "f-2",
    ]);
    expect(filterListings(ALL, { listingType: "specialist" }).map((l) => l.id)).toEqual(["sp-1"]);
    expect(filterListings(ALL, { listingType: "all" })).toHaveLength(3);
  });

  it("matches a specialty by its exact code", () => {
    expect(filterListings(ALL, { specialty: "orthodontics" }).map((l) => l.id)).toEqual(["f-1"]);
    // "general-dentistry" must not match a listing that only carries "periodontics".
    expect(filterListings(ALL, { specialty: "periodontics" }).map((l) => l.id)).toEqual(["f-2"]);
    expect(filterListings(ALL, { specialty: "endo" })).toHaveLength(0);
  });

  it("drops listings below the minimum rating and unrated listings", () => {
    expect(filterListings(ALL, { minRating: 4 }).map((l) => l.id)).toEqual(["sp-1"]);
    expect(filterListings(ALL, { minRating: 3 }).map((l) => l.id)).toEqual(["sp-1", "f-1"]);
  });

  it("treats a zero minimum (the slider's Any position) as no rating filter", () => {
    expect(filterListings(ALL, { minRating: 0 }).map((l) => l.id)).toEqual(["sp-1", "f-1", "f-2"]);
  });

  it("keeps only open listings when openNow is set", () => {
    expect(filterListings(ALL, { openNow: true }).map((l) => l.id)).toEqual(["sp-1"]);
    expect(filterListings(ALL, {})).toHaveLength(3);
  });
});

describe("sortListings", () => {
  it("orders by rating descending with unrated listings last", () => {
    expect(sortListings(ALL, "rating_desc").map((l) => l.id)).toEqual(["sp-1", "f-1", "f-2"]);
  });

  it("orders by rating ascending but still keeps unrated listings last", () => {
    expect(sortListings(ALL, "rating_asc").map((l) => l.id)).toEqual(["f-1", "sp-1", "f-2"]);
  });

  it("orders by review count", () => {
    expect(sortListings(ALL, "reviews_desc").map((l) => l.id)).toEqual(["sp-1", "f-1", "f-2"]);
    expect(sortListings(ALL, "reviews_asc").map((l) => l.id)).toEqual(["f-2", "f-1", "sp-1"]);
  });

  it("orders by name in both directions", () => {
    expect(sortListings(ALL, "name_asc").map((l) => l.id)).toEqual(["sp-1", "f-2", "f-1"]);
    expect(sortListings(ALL, "name_desc").map((l) => l.id)).toEqual(["f-1", "f-2", "sp-1"]);
  });

  it("does not mutate the input array", () => {
    const before = ALL.map((l) => l.id);
    sortListings(ALL, "name_desc");

    expect(ALL.map((l) => l.id)).toEqual(before);
  });
});

describe("searchListings", () => {
  it("filters first, then sorts the survivors", () => {
    const results = searchListings({ listingType: "facility", sort: "name_asc" }, ALL);

    expect(results.map((l) => l.id)).toEqual(["f-2", "f-1"]);
  });

  it("returns everything sorted by the default when no filter is picked", () => {
    expect(searchListings({}, ALL).map((l) => l.id)).toEqual(["sp-1", "f-1", "f-2"]);
  });

  it("returns an empty list for an empty market", () => {
    expect(searchListings({ query: "anything" }, [])).toEqual([]);
  });
});
