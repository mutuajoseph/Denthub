import { describe, expect, it, vi } from "vitest";

vi.mock("./apiClient", () => ({
  getJson: vi.fn(),
}));

import { getJson } from "./apiClient";
import {
  type DentistListing,
  type FacilityDetail,
  type SpecialistDetail,
  fetchFacilityDetail,
  fetchListingSearch,
  fetchSpecialistDetail,
  mapBranch,
  mapListing,
  mapProfile,
} from "./listingApi";

const getJsonMock = vi.mocked(getJson);

const wireListing: DentistListing = {
  id: "f-1",
  listing_type: "facility",
  name: "SmileCare Dental Centre",
  country_code: "KE",
  subdivision_code: "NAIROBI",
  specialty_codes: ["general-dentistry", "orthodontics"],
  rating: "4.50",
  review_count: 12,
  list_price: "1500.00",
  currency: "KES",
  open_now: true,
  phone: "+254712345678",
  verification_tier: "verified",
  clinic_name: null,
};

const wireSpecialist: DentistListing = {
  ...wireListing,
  id: "sp-1",
  listing_type: "specialist",
  name: "Dr. Wanjiku Kamau",
  rating: null,
  list_price: null,
  verification_tier: null,
  clinic_name: "SmileCare Dental Centre",
};

const specialtyName = (code: string) => (code === "general-dentistry" ? "General Dentistry" : code);

const wireBranch = {
  id: "br-1",
  facility_id: "f-1",
  facility_name: "SmileCare Dental Centre",
  name: "Westlands",
  subdivision_code: "NAIROBI",
  address: "12 Peponi Road",
  phone: "+254711000111",
  email: "westlands@smilecare.ke",
  hours: [
    { weekday: 0, opens: "08:00", closes: "17:00", is_closed: false },
    { weekday: 6, opens: null, closes: null, is_closed: true },
  ],
  open_now: true,
};

function emptyPage(): {
  items: DentistListing[];
  total: number;
  limit: number;
  offset: number;
  country_code: string;
  currency: string;
} {
  return { items: [], total: 0, limit: 100, offset: 0, country_code: "KE", currency: "KES" };
}

describe("mapListing", () => {
  it("reads the wire card into camelCase UI shape, money untouched", () => {
    const view = mapListing(wireListing, specialtyName);

    expect(view.name).toBe("SmileCare Dental Centre");
    expect(view.listingType).toBe("facility");
    expect(view.clinic).toBeNull();
    expect(view.specialtyCodes).toEqual(["general-dentistry", "orthodontics"]);
    expect(view.specialties).toEqual(["General Dentistry", "orthodontics"]);
    expect(view.amount).toBe("1500.00");
    expect(view.currency).toBe("KES");
    expect(view.openNow).toBe(true);
    expect(view.phone).toBe("+254712345678");
    expect(view.verificationTier).toBe("verified");
  });

  it("parses the Decimal rating string once and keeps null ratings null", () => {
    expect(mapListing(wireListing, specialtyName).rating).toBe(4.5);
    expect(mapListing(wireSpecialist, specialtyName).rating).toBeNull();
    expect(mapListing(wireSpecialist, specialtyName).amount).toBeNull();
  });

  it("exposes the specialist's workplace as the card's clinic", () => {
    expect(mapListing(wireSpecialist, specialtyName).clinic).toBe("SmileCare Dental Centre");
    expect(mapListing(wireSpecialist, specialtyName).verificationTier).toBeNull();
  });

  it("copies the specialty codes array so callers cannot mutate the wire payload", () => {
    const view = mapListing(wireListing, specialtyName);
    view.specialtyCodes.push("periodontics");

    expect(wireListing.specialty_codes).toEqual(["general-dentistry", "orthodontics"]);
  });
});

describe("mapBranch", () => {
  it("converts nested opening hours to the UI shape", () => {
    const branch = mapBranch(wireBranch);

    expect(branch.facilityName).toBe("SmileCare Dental Centre");
    expect(branch.hours[0]).toEqual({
      weekday: 0,
      opens: "08:00",
      closes: "17:00",
      isClosed: false,
    });
    expect(branch.hours[1]).toEqual({ weekday: 6, opens: null, closes: null, isClosed: true });
    expect(branch.openNow).toBe(true);
  });
});

describe("mapProfile", () => {
  const specialtyResolver = (code: string) => `Resolved ${code}`;

  it("maps a facility profile with its address, contact, and branches", () => {
    const detail: FacilityDetail = {
      listing: wireListing,
      address: "12 Peponi Road, Nairobi",
      phone: "+254712345678",
      email: "hello@smilecare.ke",
      verification_tier: "verified",
      branches: [wireBranch],
    };

    const profile = mapProfile(detail, specialtyResolver);

    expect(profile.address).toBe("12 Peponi Road, Nairobi");
    expect(profile.email).toBe("hello@smilecare.ke");
    expect(profile.branches).toHaveLength(1);
    expect(profile.branches[0].hours[0].isClosed).toBe(false);
    // A facility has no specialties payload of its own, so its card codes go
    // through the resolver.
    expect(profile.listing.specialties).toEqual([
      "Resolved general-dentistry",
      "Resolved orthodontics",
    ]);
  });

  it("maps a specialist profile from its own ordered specialties, not the resolver", () => {
    const detail: SpecialistDetail = {
      listing: wireSpecialist,
      slug: "dr-wanjiku-kamau",
      specialties: [
        {
          id: "sp1",
          code: "orthodontics",
          name: "Orthodontics",
          description: null,
          display_order: 1,
        },
        {
          id: "sp2",
          code: "periodontics",
          name: "Periodontics",
          description: null,
          display_order: 2,
        },
      ],
      branches: [wireBranch],
    };

    const profile = mapProfile(detail, specialtyResolver);

    expect(profile.listing.specialties).toEqual(["Orthodontics", "Periodontics"]);
    expect(profile.address).toBeNull();
    expect(profile.email).toBeNull();
    expect(profile.branches).toHaveLength(1);
  });
});

describe("fetchListingSearch", () => {
  it("hits both endpoints in parallel with the request's inputs", async () => {
    const facilitiesPage = { ...emptyPage(), items: [wireListing] };
    const specialistsPage = { ...emptyPage(), items: [wireSpecialist] };
    getJsonMock.mockResolvedValueOnce(facilitiesPage).mockResolvedValueOnce(specialistsPage);

    const controller = new AbortController();
    const items = await fetchListingSearch(
      { country: "KE", subdivisionCode: "NAIROBI", listingType: "all" },
      controller.signal,
    );

    expect(getJsonMock).toHaveBeenNthCalledWith(1, "/facilities", {
      query: { country: "KE", subdivision_code: "NAIROBI", limit: 100 },
      signal: controller.signal,
    });
    expect(getJsonMock).toHaveBeenNthCalledWith(2, "/dentists", {
      query: { country: "KE", subdivision_code: "NAIROBI", limit: 100 },
      signal: controller.signal,
    });
    expect(items.map((item) => item.id)).toEqual(["f-1", "sp-1"]);
  });

  it("asks only the facility endpoint for listingType facility", async () => {
    getJsonMock.mockResolvedValue({ ...emptyPage(), items: [wireListing] });

    const items = await fetchListingSearch({ country: "KE", listingType: "facility" });

    expect(getJsonMock).toHaveBeenCalledTimes(1);
    expect(getJsonMock).toHaveBeenCalledWith("/facilities", expect.anything());
    expect(items).toHaveLength(1);
  });

  it("asks only the dentist endpoint for listingType specialist", async () => {
    getJsonMock.mockResolvedValue({ ...emptyPage(), items: [wireSpecialist] });

    const items = await fetchListingSearch({ country: "KE", listingType: "specialist" });

    expect(getJsonMock).toHaveBeenCalledTimes(1);
    expect(getJsonMock).toHaveBeenCalledWith("/dentists", expect.anything());
    expect(items).toHaveLength(1);
  });

  it("passes no subdivision_code when the page did not pick one", async () => {
    getJsonMock.mockResolvedValue(emptyPage());

    await fetchListingSearch({ country: "KE" });

    expect(getJsonMock).toHaveBeenCalledWith("/facilities", {
      query: { country: "KE", subdivision_code: undefined, limit: 100 },
      signal: undefined,
    });
  });
});

describe("detail fetchers", () => {
  it("encodes the id in the profile path", async () => {
    getJsonMock.mockResolvedValue({});

    await fetchFacilityDetail("f 1");
    expect(getJsonMock).toHaveBeenCalledWith("/facilities/f%201", { signal: undefined });

    await fetchSpecialistDetail("sp/1");
    expect(getJsonMock).toHaveBeenCalledWith("/dentists/sp%2F1", { signal: undefined });
  });
});
