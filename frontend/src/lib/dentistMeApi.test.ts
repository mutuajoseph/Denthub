import { describe, expect, it, vi } from "vitest";

vi.mock("./apiClient", () => ({
  getJson: vi.fn(),
  patchJson: vi.fn(),
  postJson: vi.fn(),
}));

import { getJson, patchJson, postJson } from "./apiClient";
import { createMySpecialist, fetchMySpecialist, updateMySpecialist } from "./dentistMeApi";

const getJsonMock = vi.mocked(getJson);
const patchJsonMock = vi.mocked(patchJson);
const postJsonMock = vi.mocked(postJson);

const wireSpecialist = {
  id: "sp-1",
  name: "Dr. Wanjiku Kamau",
  slug: "dr-wanjiku-kamau",
  bio: "Preventive dentistry.",
  avatar_key: null,
  country_code: "KE",
  subdivision_code: "NAIROBI",
  currency: "KES",
  verification_tier: "unverified" as const,
  specialties: [
    {
      id: "spc-1",
      code: "orthodontics",
      name: "Orthodontics",
      description: null,
      display_order: 1,
    },
  ],
  branches: [
    {
      id: "br-1",
      facility_id: "f-1",
      facility_name: "SmileCare",
      name: "Westlands",
      subdivision_code: "NAIROBI",
      address: "12 Peponi Road",
      phone: null,
      email: null,
      hours: [],
      open_now: false,
    },
  ],
};

describe("dentistMeApi", () => {
  it("reads and maps the caller's own listing", async () => {
    const signal = new AbortController().signal;
    getJsonMock.mockResolvedValue(wireSpecialist);

    const listing = await fetchMySpecialist({ signal });

    expect(getJsonMock).toHaveBeenCalledWith("/dentists/me", { auth: true, signal });
    expect(listing.bio).toBe("Preventive dentistry.");
    expect(listing.avatarKey).toBeNull();
    expect(listing.specialties[0]?.code).toBe("orthodontics");
    expect(listing.branches[0]?.facilityName).toBe("SmileCare");
  });

  it("creates a listing with the caller's token", async () => {
    postJsonMock.mockResolvedValue(wireSpecialist);

    const listing = await createMySpecialist({
      country_code: "KE",
      subdivision_code: "NAIROBI",
      bio: "Preventive dentistry.",
      specialty_codes: ["orthodontics"],
      branch_ids: ["br-1"],
    });

    expect(postJsonMock).toHaveBeenCalledWith(
      "/dentists/me",
      {
        country_code: "KE",
        subdivision_code: "NAIROBI",
        bio: "Preventive dentistry.",
        specialty_codes: ["orthodontics"],
        branch_ids: ["br-1"],
      },
      { auth: true },
    );
    expect(listing.id).toBe("sp-1");
  });

  it("patches only the fields being changed", async () => {
    patchJsonMock.mockResolvedValue({ ...wireSpecialist, bio: "Now focused on children." });

    const listing = await updateMySpecialist({
      bio: "Now focused on children.",
      specialty_codes: ["paediatric-dentistry"],
      branch_ids: [],
    });

    expect(patchJsonMock).toHaveBeenCalledWith(
      "/dentists/me",
      {
        bio: "Now focused on children.",
        specialty_codes: ["paediatric-dentistry"],
        branch_ids: [],
      },
      { auth: true },
    );
    expect(listing.bio).toBe("Now focused on children.");
  });
});
