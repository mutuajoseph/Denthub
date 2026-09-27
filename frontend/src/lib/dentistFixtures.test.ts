import { describe, expect, it } from "vitest";
import {
  DENTIST_FIXTURES,
  type LegacyPracticeFixture,
  type LegacySpecialistFixture,
  getDentistFixtureById,
  listDentistFixtures,
  mapLegacyPracticeFixture,
  mapLegacySpecialistFixture,
} from "./dentistFixtures";

describe("dentist fixtures", () => {
  it("maps the legacy Wanjiku listing into the unified listing shape", () => {
    const listing = getDentistFixtureById("sp-1");

    expect(listing).toMatchObject({
      id: "sp-1",
      listingType: "specialist",
      name: "Dr. Wanjiku Kamau",
      clinic: "SmileCare Dental Centre",
      specialties: ["Implants", "Cosmetic"],
      location: {
        countryCode: "KE",
        subdivision: "Nairobi",
        city: "Westlands",
        operatingAreas: [],
      },
      rating: 4.9,
      reviewCount: 187,
      insurance: {
        nationalScheme: "NHIF",
        accepted: ["Jubilee", "AAR"],
      },
      hours: {
        summary: "Mon-Sat 8am-7pm",
        openNow: true,
      },
      pricing: {
        amount: 2500,
        currency: "KES",
      },
    });
  });

  it("maps legacy practice area and team data", () => {
    const listing = getDentistFixtureById("pr-3");

    expect(listing).toMatchObject({
      id: "pr-3",
      listingType: "practice",
      name: "Coast Maxillofacial Centre",
      clinic: null,
      location: {
        countryCode: "KE",
        subdivision: "Mombasa",
        city: "Nyali",
        operatingAreas: ["Mombasa", "Kilifi", "Kwale"],
      },
      specialties: ["Oral & Maxillofacial Surgery", "Implants"],
      teamSize: 3,
      rating: 4.7,
      pricing: {
        amount: 4000,
        currency: "KES",
      },
    });
  });

  it("maps additional market data with its local insurance scheme", () => {
    const listing = getDentistFixtureById("ng-sp-1");

    expect(listing).toMatchObject({
      id: "ng-sp-1",
      location: {
        countryCode: "NG",
        subdivision: "Lagos",
        city: "Victoria Island",
      },
      insurance: {
        nationalScheme: "NHIS",
      },
      pricing: {
        currency: "NGN",
      },
    });
  });

  it("maps a raw legacy specialist without losing its profile fields", () => {
    const source: LegacySpecialistFixture = {
      id: "test-specialist",
      listingType: "specialist",
      name: "Dr. Test Person",
      clinic: "Test Dental",
      specialty: ["General"],
      county: "Nairobi",
      town: "Nairobi",
      rating: 4.2,
      reviews: 12,
      nhif: false,
      insurance: ["Test Plan"],
      verified: true,
      approved: true,
      excellence: false,
      openNow: false,
      hours: "Mon-Fri 9am-5pm",
      priceFrom: 1500,
      phone: "+254700000000",
    };

    const listing = mapLegacySpecialistFixture(source);

    expect(listing).toMatchObject({
      id: "test-specialist",
      name: "Dr. Test Person",
      location: {
        countryCode: "KE",
        subdivision: "Nairobi",
        city: "Nairobi",
      },
      reviewCount: 12,
      insurance: {
        nationalScheme: null,
        accepted: ["Test Plan"],
      },
      pricing: {
        amount: 1500,
        currency: "KES",
      },
    });
  });

  it("keeps the exported fixture collection deeply immutable", () => {
    const first = DENTIST_FIXTURES[0];

    expect(Object.isFrozen(DENTIST_FIXTURES)).toBe(true);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.location)).toBe(true);
    expect(Object.isFrozen(first.location.operatingAreas)).toBe(true);
    expect(Object.isFrozen(first.insurance.accepted)).toBe(true);
    expect(Object.isFrozen(first.pricing)).toBe(true);
    expect(() => {
      (first.location.operatingAreas as string[]).push("Unexpected");
    }).toThrow();
  });

  it("lists every fixture and looks up an unknown id safely", () => {
    const ids = listDentistFixtures().map((listing) => listing.id);

    expect(ids).toEqual(
      expect.arrayContaining([
        "sp-1",
        "sp-5",
        "pr-1",
        "pr-5",
        "ng-sp-1",
        "gb-pr-1",
        "us-sp-1",
        "ae-pr-1",
        "za-sp-1",
        "in-pr-1",
        "tr-sp-1",
      ]),
    );
    expect(getDentistFixtureById("does-not-exist")).toBeUndefined();
  });

  it("keeps practice mapping available as a typed public seam", () => {
    const source: LegacyPracticeFixture = {
      id: "test-practice",
      listingType: "practice",
      name: "Test Practice",
      specialty: ["General"],
      operatingAreas: ["Nairobi", "Kiambu"],
      county: "Nairobi",
      town: "Westlands",
      rating: 4,
      reviews: 20,
      nhif: true,
      insurance: ["Test Plan"],
      verified: true,
      approved: true,
      excellence: false,
      openNow: true,
      hours: "Mon-Fri 8am-5pm",
      priceFrom: 1800,
      phone: "+254700000001",
      teamSize: 2,
    };

    expect(mapLegacyPracticeFixture(source)).toMatchObject({
      id: "test-practice",
      listingType: "practice",
      location: {
        operatingAreas: ["Nairobi", "Kiambu"],
      },
      teamSize: 2,
      insurance: {
        nationalScheme: "NHIF",
      },
    });
  });
});
