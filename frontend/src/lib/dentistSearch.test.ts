import { describe, expect, it } from "vitest";
import { DENTIST_FIXTURES } from "./dentistFixtures";
import {
  type DentistSearchFilters,
  filterDentistListings,
  searchDentistListings,
  sortDentistListings,
} from "./dentistSearch";

describe("dentist search", () => {
  it("finds a specialist by a free-text name", () => {
    const results = searchDentistListings({ query: "wanjiku" });

    expect(results.map((listing) => listing.id)).toEqual(["sp-1"]);
  });

  it("searches across names, clinics, specialties, and locations", () => {
    const results = searchDentistListings({ query: "westlands implants" });

    expect(results.map((listing) => listing.id)).toEqual(expect.arrayContaining(["sp-1", "pr-1"]));
  });

  it("filters by country and subdivision", () => {
    const kenya = searchDentistListings({
      countryCode: "KE",
      subdivision: "Kisumu",
    });
    const nigeria = searchDentistListings({
      country: "NG",
      region: "Lagos",
    });

    expect(kenya.map((listing) => listing.id)).toEqual(["sp-3"]);
    expect(nigeria.map((listing) => listing.id)).toEqual(["ng-sp-1"]);
  });

  it("filters by listing type", () => {
    const results = searchDentistListings({
      countryCode: "KE",
      listingType: "practice",
    });

    expect(results.map((listing) => listing.id)).toEqual(
      expect.arrayContaining(["pr-1", "pr-2", "pr-3", "pr-4", "pr-5"]),
    );
    expect(results.every((listing) => listing.listingType === "practice")).toBe(true);
  });

  it("filters by one or more specialties", () => {
    const single = searchDentistListings({ countryCode: "KE", specialty: "Periodontics" });
    const multiple = searchDentistListings({
      countryCode: "KE",
      specialties: ["Orthodontics", "Endodontics"],
    });

    expect(single.map((listing) => listing.id)).toEqual(["pr-5"]);
    expect(multiple.map((listing) => listing.id)).toEqual(expect.arrayContaining(["sp-5", "pr-4"]));
  });

  it("matches insurance labels without relying on country defaults", () => {
    const results = searchDentistListings({
      countryCode: "KE",
      insurance: "AAR",
      minRating: 4.7,
      openNow: true,
    });

    expect(results.map((listing) => listing.id)).toEqual(
      expect.arrayContaining(["sp-1", "sp-2", "sp-4", "pr-1", "pr-2"]),
    );
    expect(results.every((listing) => listing.insurance.accepted.includes("AAR"))).toBe(true);
    expect(results.every((listing) => listing.rating >= 4.7 && listing.hours.openNow)).toBe(true);
  });

  it("applies the requested country, listing type, and rating together", () => {
    const filters: DentistSearchFilters = {
      countryCode: "KE",
      listingType: "practice",
      minRating: 4.9,
      openNow: true,
    };

    const results = searchDentistListings(filters);

    expect(results.map((listing) => listing.id)).toEqual(["pr-1"]);
  });

  it("sorts by price and produces the same order on repeated searches", () => {
    const filters: DentistSearchFilters = {
      countryCode: "KE",
      sort: "price_asc",
    };
    const first = searchDentistListings(filters);
    const second = searchDentistListings(filters);

    expect(first.map((listing) => listing.id)).toEqual([
      "pr-1",
      "pr-5",
      "sp-1",
      "sp-5",
      "pr-2",
      "pr-3",
      "sp-3",
      "pr-4",
      "sp-4",
      "sp-2",
    ]);
    expect(second).toEqual(first);
  });

  it("sorts by rating with a deterministic tie-breaker", () => {
    const results = sortDentistListings(
      DENTIST_FIXTURES.filter((listing) => listing.location.countryCode === "KE"),
      "rating_desc",
    );

    expect(results.slice(0, 6).map((listing) => listing.id)).toEqual([
      "sp-1",
      "pr-1",
      "sp-4",
      "sp-2",
      "pr-5",
      "pr-2",
    ]);
  });

  it("does not mutate the source collection while filtering or sorting", () => {
    const before = DENTIST_FIXTURES.map((listing) => listing.id);

    filterDentistListings(DENTIST_FIXTURES, { countryCode: "KE" });
    sortDentistListings(DENTIST_FIXTURES, "name_asc");

    expect(DENTIST_FIXTURES.map((listing) => listing.id)).toEqual(before);
  });

  it("supports an alternate fixture source for local rendering", () => {
    const source = [DENTIST_FIXTURES[0], DENTIST_FIXTURES[2]];
    const results = searchDentistListings({ openNow: true }, source);

    expect(results.map((listing) => listing.id)).toEqual(["sp-1"]);
  });
});
