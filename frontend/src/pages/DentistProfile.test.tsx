import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../lib/apiClient";
import { type CountryConfig, fetchCountryConfig, fetchSpecialties } from "../lib/countryConfigApi";
import {
  type DentistListing,
  type FacilityDetail,
  type SpecialistDetail,
  fetchFacilityDetail,
  fetchSpecialistDetail,
} from "../lib/listingApi";
import { useCountryConfigStore } from "../store/countryConfigStore";
import { useRegionStore } from "../store/regionStore";
import { DentistProfile } from "./DentistProfile";

vi.mock("../lib/listingApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/listingApi")>();

  return {
    ...actual,
    fetchFacilityDetail: vi.fn(),
    fetchSpecialistDetail: vi.fn(),
  };
});

vi.mock("../lib/countryConfigApi", () => ({
  fetchCountries: vi.fn(),
  fetchCountryConfig: vi.fn(),
  fetchSpecialties: vi.fn(),
}));

const fetchFacilityDetailMock = vi.mocked(fetchFacilityDetail);
const fetchSpecialistDetailMock = vi.mocked(fetchSpecialistDetail);
const fetchCountryConfigMock = vi.mocked(fetchCountryConfig);
const fetchSpecialtiesMock = vi.mocked(fetchSpecialties);

const WEEKDAY_HOURS = [
  { weekday: 0, opens: "08:00", closes: "17:00", is_closed: false },
  { weekday: 1, opens: "08:00", closes: "17:00", is_closed: false },
  { weekday: 2, opens: "08:00", closes: "17:00", is_closed: false },
  { weekday: 3, opens: "08:00", closes: "17:00", is_closed: false },
  { weekday: 4, opens: "08:00", closes: "17:00", is_closed: false },
  { weekday: 5, opens: "09:00", closes: "13:00", is_closed: false },
  { weekday: 6, opens: null, closes: null, is_closed: true },
];

const facilityListing: DentistListing = {
  id: "f-1",
  listing_type: "facility",
  name: "SmileCare Dental Centre",
  country_code: "KE",
  subdivision_code: "NAIROBI",
  specialty_codes: ["general-dentistry"],
  rating: "4.50",
  review_count: 12,
  list_price: "1500.00",
  currency: "KES",
  open_now: true,
  phone: "+254712345678",
  verification_tier: "verified",
  clinic_name: null,
};

const facilityDetail: FacilityDetail = {
  listing: facilityListing,
  address: "12 Peponi Road, Nairobi",
  phone: "+254712345678",
  email: "hello@smilecare.ke",
  verification_tier: "verified",
  branches: [
    {
      id: "br-1",
      facility_id: "f-1",
      facility_name: "SmileCare Dental Centre",
      name: "Westlands",
      subdivision_code: "NAIROBI",
      address: "12 Peponi Road",
      phone: "+254712345678",
      email: "westlands@smilecare.ke",
      hours: WEEKDAY_HOURS,
      open_now: true,
    },
  ],
};

const specialistListing: DentistListing = {
  id: "sp-1",
  listing_type: "specialist",
  name: "Dr. Wanjiku Kamau",
  country_code: "KE",
  subdivision_code: "NAIROBI",
  specialty_codes: ["general-dentistry"],
  rating: "4.50",
  review_count: 12,
  list_price: null,
  currency: "KES",
  open_now: true,
  phone: "+254711223344",
  verification_tier: null,
  clinic_name: "SmileCare Dental Centre",
};

const specialistDetail: SpecialistDetail = {
  listing: specialistListing,
  slug: "dr-wanjiku-kamau",
  specialties: [
    {
      id: "sp1",
      code: "general-dentistry",
      name: "General Dentistry",
      description: null,
      display_order: 1,
    },
  ],
  branches: [
    {
      id: "br-1",
      facility_id: "f-1",
      facility_name: "SmileCare Dental Centre",
      name: null,
      subdivision_code: "NAIROBI",
      address: "12 Peponi Road",
      phone: "+254711223344",
      email: null,
      hours: WEEKDAY_HOURS,
      open_now: true,
    },
    {
      id: "br-2",
      facility_id: "f-2",
      facility_name: "Westlands Medical Centre",
      name: null,
      subdivision_code: "NAIROBI",
      address: "4 Hospital Road",
      phone: null,
      email: null,
      hours: WEEKDAY_HOURS,
      open_now: false,
    },
  ],
};

function makeConfig(code: string): CountryConfig {
  return {
    code,
    name: code,
    currency: "KES",
    currencySymbol: "KSh",
    locale: "en-KE",
    geography: { subdivisionLabel: "County", subdivisionPlural: "Counties", cityLabel: "City" },
    features: {},
    featureConfigs: {},
    featureContexts: {},
    insuranceProviders: [],
    regions: [],
  };
}

function renderProfile(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/dentists/:listingType/:id" element={<DentistProfile />} />
          <Route path="/dentists/:id" element={<DentistProfile />} />
          <Route path="/dentist/:id" element={<DentistProfile />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function notFound(): ApiError {
  return new ApiError("Not found", { status: 404, code: "NOT_FOUND" });
}

describe("DentistProfile", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useRegionStore.setState({ regionCode: "KE", hasManualSelection: true });
    useCountryConfigStore.setState({
      config: null,
      regions: [],
      lastCountry: null,
      error: null,
      loading: false,
      regionsLoading: false,
    });
    fetchCountryConfigMock.mockImplementation(async (code) => makeConfig(code ?? "KE"));
    fetchSpecialtiesMock.mockResolvedValue([
      {
        id: "sp1",
        code: "general-dentistry",
        name: "General Dentistry",
        description: null,
        display_order: 1,
      },
    ]);
    fetchFacilityDetailMock.mockResolvedValue(facilityDetail);
    fetchSpecialistDetailMock.mockResolvedValue(specialistDetail);
  });

  it("renders a facility profile from the typed route", async () => {
    renderProfile("/dentists/facility/f-1");

    expect(
      await screen.findByRole("heading", { name: "SmileCare Dental Centre" }),
    ).toBeInTheDocument();
    expect(fetchFacilityDetailMock).toHaveBeenCalledWith("f-1", expect.anything());
    expect(fetchSpecialistDetailMock).not.toHaveBeenCalled();

    expect(screen.getByText("12 Peponi Road, Nairobi")).toBeInTheDocument();
    expect(
      screen.getByText("Mon–Fri 08:00–17:00 · Sat 09:00–13:00 · Sun closed"),
    ).toBeInTheDocument();
    expect(screen.getByText("KES 1,500")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /call smilecare dental centre/i })).toHaveAttribute(
      "href",
      "tel:+254712345678",
    );
  });

  it("renders a specialist profile from the typed route with labelled workplaces", async () => {
    renderProfile("/dentists/specialist/sp-1");

    expect(await screen.findByRole("heading", { name: "Dr. Wanjiku Kamau" })).toBeInTheDocument();
    expect(fetchSpecialistDetailMock).toHaveBeenCalledWith("sp-1", expect.anything());
    expect(fetchFacilityDetailMock).not.toHaveBeenCalled();

    expect(screen.getByText("General Dentistry")).toBeInTheDocument();
    expect(screen.getByText("SmileCare Dental Centre: 12 Peponi Road")).toBeInTheDocument();
    expect(screen.getByText("Westlands Medical Centre: 4 Hospital Road")).toBeInTheDocument();
    // Each workplace prefixes its hours line; matched loosely because the
    // label sits in a span next to the summary text node.
    expect(
      screen.getByText(
        (_content, element) =>
          element?.tagName === "LI" &&
          (element.textContent ?? "").includes("SmileCare Dental Centre") &&
          (element.textContent ?? "").includes("Mon–Fri 08:00–17:00"),
      ),
    ).toBeInTheDocument();
    // The specialist card has no fee of its own; no price block renders.
    expect(screen.queryByText(/consultation from/i)).not.toBeInTheDocument();
  });

  it("resolves a legacy typeless id by trying a facility, then a specialist", async () => {
    fetchFacilityDetailMock.mockRejectedValueOnce(notFound());
    renderProfile("/dentists/sp-1");

    expect(await screen.findByRole("heading", { name: "Dr. Wanjiku Kamau" })).toBeInTheDocument();
    expect(fetchFacilityDetailMock).toHaveBeenCalledWith("sp-1", expect.anything());
    expect(fetchSpecialistDetailMock).toHaveBeenCalledWith("sp-1", expect.anything());
  });

  it("offers a not-found state and a route back to search when neither id resolves", async () => {
    fetchFacilityDetailMock.mockRejectedValue(notFound());
    fetchSpecialistDetailMock.mockRejectedValue(notFound());
    renderProfile("/dentists/unknown-provider");

    expect(
      await screen.findByRole("heading", { name: "Dental provider not found" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/unknown-provider/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to dentist search/i })).toHaveAttribute(
      "href",
      "/find-dentist",
    );
  });

  it("surfaces a server failure with a retry, then renders once it recovers", async () => {
    fetchFacilityDetailMock.mockRejectedValueOnce(new Error("server exploded"));
    const user = userEvent.setup();
    renderProfile("/dentists/facility/f-1");

    expect(
      await screen.findByRole("heading", { name: "Could not load this profile" }),
    ).toBeInTheDocument();
    expect(screen.getByText("server exploded")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(
      await screen.findByRole("heading", { name: "SmileCare Dental Centre" }),
    ).toBeInTheDocument();
  });

  it("shows a loading state before the profile arrives", async () => {
    fetchFacilityDetailMock.mockReturnValue(new Promise(() => {}));
    renderProfile("/dentists/facility/f-1");

    expect(await screen.findByRole("status")).toHaveTextContent(/loading profile/i);
  });

  it("previews an appointment request without claiming it was sent", async () => {
    renderProfile("/dentists/specialist/sp-1");

    expect(
      await screen.findByText(/build an appointment message for dr\. wanjiku kamau/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dr. Wanjiku Kamau" })).toBeInTheDocument();
  });

  it("hides every call action when the listing publishes no phone", async () => {
    fetchSpecialistDetailMock.mockResolvedValue({
      ...specialistDetail,
      listing: { ...specialistListing, phone: null },
    });
    renderProfile("/dentists/specialist/sp-1");

    expect(await screen.findByRole("heading", { name: "Dr. Wanjiku Kamau" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /call/i })).not.toBeInTheDocument();
  });
});
