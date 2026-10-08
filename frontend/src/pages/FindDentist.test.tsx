import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
import { FindDentist } from "./FindDentist";

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

const wireSpecialist: DentistListing = {
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

const wireFacility: DentistListing = {
  id: "f-1",
  listing_type: "facility",
  name: "Eldoret Dental Hub",
  country_code: "KE",
  subdivision_code: "UASIN_GISHU",
  specialty_codes: ["orthodontics"],
  rating: null,
  review_count: 0,
  list_price: "1500.00",
  currency: "KES",
  open_now: false,
  phone: null,
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
        <FindDentist />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("FindDentist", () => {
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
    fetchSubdivisionsMock.mockResolvedValue([
      { id: "KE-NAIROBI", name: "Nairobi", code: "NAIROBI", countryCode: "KE" },
    ]);
    fetchSpecialtiesMock.mockResolvedValue([
      {
        id: "sp1",
        code: "general-dentistry",
        name: "General Dentistry",
        description: null,
        display_order: 1,
      },
      {
        id: "sp2",
        code: "orthodontics",
        name: "Orthodontics",
        description: null,
        display_order: 2,
      },
    ]);
    fetchListingSearchMock.mockResolvedValue([wireSpecialist, wireFacility]);
  });

  it("renders the market's results and links each card to its typed profile", async () => {
    renderPage();

    expect(await screen.findByText("2 results")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dr. Wanjiku Kamau" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View profile for Dr. Wanjiku Kamau" }),
    ).toHaveAttribute("href", "/dentists/specialist/sp-1");
    expect(
      screen.getByRole("link", { name: "View profile for Eldoret Dental Hub" }),
    ).toHaveAttribute("href", "/dentists/facility/f-1");
    expect(screen.getByText("SmileCare Dental Centre")).toBeInTheDocument();
  });

  it("filters in memory by free text without refetching the market", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("2 results");

    await user.type(
      screen.getByRole("searchbox", { name: /search dentists and practices/i }),
      "Wanjiku",
    );

    expect(await screen.findByText("1 result")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Eldoret Dental Hub" })).not.toBeInTheDocument();
    expect(fetchListingSearchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps only open listings when the Open now filter is checked", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("2 results");

    await user.click(screen.getByRole("checkbox", { name: /open now/i }));

    expect(await screen.findByText("1 result")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dr. Wanjiku Kamau" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Eldoret Dental Hub" })).not.toBeInTheDocument();
  });

  it("refetches for the new market when the country combo changes", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("2 results");

    await user.selectOptions(screen.getByLabelText(/^country$/i), "NG");

    expect(useRegionStore.getState().regionCode).toBe("NG");
    await waitFor(() => {
      expect(fetchListingSearchMock).toHaveBeenCalledWith(
        expect.objectContaining({ country: "NG" }),
        expect.anything(),
      );
    });
  });

  it("shows a loading state while the market is being fetched", async () => {
    fetchListingSearchMock.mockReturnValue(new Promise(() => {}));
    renderPage();

    // `<output>` in the filters sidebar also carries role="status", so the
    // loading block is matched on its copy rather than the role alone.
    expect(await screen.findByText(/loading dental providers/i)).toBeInTheDocument();
  });

  it("offers a retry when the directory cannot be loaded", async () => {
    fetchListingSearchMock
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce([wireSpecialist]);
    const user = userEvent.setup();
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/directory unavailable/i);
    expect(alert).toHaveTextContent(/network down/i);

    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(await screen.findByText("1 result")).toBeInTheDocument();
  });

  it("offers a clear-filters escape hatch when nothing matches", async () => {
    fetchListingSearchMock.mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("0 results")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /no dental providers match/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /clear all filters/i }));
    expect(screen.getByText("0 results")).toBeInTheDocument();
  });
});
