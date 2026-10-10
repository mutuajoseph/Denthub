import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { NAV_LINKS } from "./components/Navbar";
import { getPageMeta } from "./hooks/usePageMeta";
import { ApiError } from "./lib/apiClient";
import {
  type CountryConfig,
  fetchCountries,
  fetchCountryConfig,
  fetchSpecialties,
} from "./lib/countryConfigApi";
import {
  type FacilityDetail,
  type SpecialistDetail,
  fetchFacilityDetail,
  fetchListingSearch,
  fetchSpecialistDetail,
} from "./lib/listingApi";

vi.mock("./lib/listingApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/listingApi")>();

  return {
    ...actual,
    fetchListingSearch: vi.fn(),
    fetchFacilityDetail: vi.fn(),
    fetchSpecialistDetail: vi.fn(),
  };
});

vi.mock("./lib/countryConfigApi", () => ({
  fetchCountries: vi.fn(),
  fetchCountryConfig: vi.fn(),
  fetchSpecialties: vi.fn(),
}));

const fetchListingSearchMock = vi.mocked(fetchListingSearch);
const fetchFacilityDetailMock = vi.mocked(fetchFacilityDetail);
const fetchSpecialistDetailMock = vi.mocked(fetchSpecialistDetail);
const fetchCountriesMock = vi.mocked(fetchCountries);
const fetchCountryConfigMock = vi.mocked(fetchCountryConfig);
const fetchSpecialtiesMock = vi.mocked(fetchSpecialties);

const facilityDetail: FacilityDetail = {
  listing: {
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
  },
  address: "12 Peponi Road, Nairobi",
  phone: "+254712345678",
  email: "hello@smilecare.ke",
  verification_tier: "verified",
  branches: [],
};

const specialistDetail: SpecialistDetail = {
  listing: {
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
  },
  slug: "dr-wanjiku-kamau",
  specialties: [],
  branches: [],
};

function makeConfig(code: string): CountryConfig {
  return {
    code,
    name: "Kenya",
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

function renderApp(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("App routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fetchListingSearchMock.mockResolvedValue([]);
    fetchCountriesMock.mockResolvedValue({ items: [], default_country_code: "KE" });
    fetchCountryConfigMock.mockImplementation(async (code) => makeConfig(code ?? "KE"));
    fetchSpecialtiesMock.mockResolvedValue([]);
    fetchFacilityDetailMock.mockResolvedValue(facilityDetail);
    fetchSpecialistDetailMock.mockResolvedValue(specialistDetail);
  });

  it("renders the home page at /", () => {
    const { container } = renderApp("/");

    expect(container.querySelector("#hero-heading")).not.toBeNull();
  });

  it.each(["/dentists", "/find-dentist"])("renders dentist discovery at %s", (path) => {
    renderApp(path);

    expect(
      screen.getByRole("heading", { name: /find the right dental care/i }),
    ).toBeInTheDocument();
  });

  it("renders a profile at the typed route", async () => {
    renderApp("/dentists/facility/f-1");

    expect(
      await screen.findByRole("heading", { name: /smilecare dental centre/i }),
    ).toBeInTheDocument();
    expect(fetchFacilityDetailMock).toHaveBeenCalledWith("f-1", expect.anything());
    expect(fetchSpecialistDetailMock).not.toHaveBeenCalled();
  });

  it.each(["/dentists/sp-1", "/dentist/sp-1"])(
    "renders a profile at the legacy route %s via specialist fallback",
    async (path) => {
      fetchFacilityDetailMock.mockRejectedValue(
        new ApiError("Not found", { status: 404, code: "NOT_FOUND" }),
      );

      renderApp(path);

      expect(
        await screen.findByRole("heading", { name: /dr\. wanjiku kamau/i }),
      ).toBeInTheDocument();
      expect(fetchSpecialistDetailMock).toHaveBeenCalledWith("sp-1", expect.anything());
    },
  );

  it("renders the international patient page", () => {
    renderApp("/international");

    expect(screen.getByRole("heading", { name: /plan your dental journey/i })).toBeInTheDocument();
  });

  it("renders the emergency page", () => {
    renderApp("/emergency");

    expect(
      screen.getByRole("heading", { name: /find emergency dental care now/i }),
    ).toBeInTheDocument();
  });

  it("renders NotFound for unknown routes", () => {
    renderApp("/definitely-not-a-page");

    expect(screen.getByRole("heading", { name: /page not found/i })).toBeInTheDocument();
  });

  // Regression guard: every public navbar link used to fall through to NotFound.
  it.each(NAV_LINKS.map((link) => [link.label, link.href] as const))(
    "routes the %s nav link (%s) to a real page",
    (_label, href) => {
      renderApp(href);

      expect(screen.queryByRole("heading", { name: /page not found/i })).toBeNull();
    },
  );

  it("keeps dedicated page metadata for every non-home nav route", () => {
    // "/" intentionally reuses the home metadata, so it is excluded here.
    const nonHome = NAV_LINKS.filter((link) => link.href !== "/");
    expect(nonHome.length).toBeGreaterThan(0);

    for (const link of nonHome) {
      expect(getPageMeta(link.href, "DentHub").title).not.toMatch(/Complete Dental Platform/);
    }
  });

  it("titles typed and legacy dentist profile routes alike", () => {
    for (const path of ["/dentists/facility/f-1", "/dentists/sp-1", "/dentist/sp-1"]) {
      expect(getPageMeta(path, "DentHub").title).toMatch(/dentist profile/i);
    }
  });
});
