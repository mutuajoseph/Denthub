import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type CountryConfig,
  fetchCountryConfig,
  fetchSpecialties,
  fetchSubdivisions,
} from "../lib/countryConfigApi";
import { type DentistListing, fetchListingSearch } from "../lib/listingApi";
import { useCountryConfigStore } from "../store/countryConfigStore";
import { useRegionStore } from "../store/regionStore";
import { Emergency } from "./Emergency";

vi.mock("../lib/listingApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/listingApi")>();

  return { ...actual, fetchListingSearch: vi.fn() };
});

vi.mock("../lib/countryConfigApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/countryConfigApi")>();

  return {
    ...actual,
    fetchCountryConfig: vi.fn(),
    fetchSubdivisions: vi.fn(),
    fetchSpecialties: vi.fn(),
  };
});

const fetchListingSearchMock = vi.mocked(fetchListingSearch);
const fetchCountryConfigMock = vi.mocked(fetchCountryConfig);
const fetchSubdivisionsMock = vi.mocked(fetchSubdivisions);
const fetchSpecialtiesMock = vi.mocked(fetchSpecialties);

const openSpecialist: DentistListing = {
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
  phone: "+254712345678",
  verification_tier: null,
  clinic_name: "SmileCare Dental Centre",
};

const closedFacility: DentistListing = {
  id: "f-1",
  listing_type: "facility",
  name: "Eldoret Dental Hub",
  country_code: "KE",
  subdivision_code: "UASIN_GISHU",
  specialty_codes: ["orthodontics"],
  rating: null,
  review_count: 0,
  list_price: null,
  currency: "KES",
  open_now: false,
  phone: "+254711000111",
  verification_tier: "verified",
  clinic_name: null,
};

function makeConfig(code: string): CountryConfig {
  return {
    code,
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

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Emergency />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Emergency", () => {
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
    fetchSubdivisionsMock.mockResolvedValue([]);
    fetchSpecialtiesMock.mockResolvedValue([]);
    fetchListingSearchMock.mockResolvedValue([openSpecialist, closedFacility]);
  });

  it("shows only listings marked open now with direct call links", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Open dental listings" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dr. Wanjiku Kamau" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Eldoret Dental Hub" })).not.toBeInTheDocument();
    expect(screen.getByText("1 listing marked open now")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /call dr\. wanjiku kamau/i })).toHaveAttribute(
      "href",
      "tel:+254712345678",
    );
  });

  it("offers urgent-care guidance without diagnosis or triage claims", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: /if your symptoms feel urgent/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/contact your local emergency service now/i)).toBeInTheDocument();
    expect(screen.getByText(/does not diagnose symptoms or assess urgency/i)).toBeInTheDocument();
    expect(screen.getByText(/call first to confirm urgent capacity/i)).toBeInTheDocument();
  });

  it("points to emergency services when the directory shows nothing open", async () => {
    fetchListingSearchMock.mockResolvedValue([]);
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "No open listings are available" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/contact your local emergency service if your symptoms feel urgent/i),
    ).toBeInTheDocument();
    expect(screen.getByText("0 listings marked open now")).toBeInTheDocument();
  });

  it("surfaces a load failure as an alert when no data has arrived", async () => {
    fetchListingSearchMock.mockRejectedValue(new Error("network down"));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(/directory unavailable/i);
  });
});
