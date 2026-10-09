import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useCountryConfig } from "../../hooks/useCountryConfig";
import { useHomeFeatured } from "../../hooks/useHome";
import { useRegion } from "../../hooks/useRegion";
import type { ListingView } from "../../lib/listingApi";
import FeaturedClinics from "./FeaturedClinics";

vi.mock("../../hooks/useHome", () => ({ useHomeFeatured: vi.fn() }));
vi.mock("../../hooks/useCountryConfig", () => ({ useCountryConfig: vi.fn() }));
vi.mock("../../hooks/useRegion", () => ({ useRegion: vi.fn() }));

vi.mocked(useCountryConfig).mockReturnValue({
  apiCountry: "KE",
} as unknown as ReturnType<typeof useCountryConfig>);
vi.mocked(useRegion).mockReturnValue({
  countryName: "Kenya",
} as unknown as ReturnType<typeof useRegion>);

const clinic: ListingView = {
  id: "p1",
  listingType: "facility",
  name: "SmileCare Dental",
  clinic: null,
  specialtyCodes: ["general-dentistry", "cosmetic-dentistry"],
  specialties: ["General Dentistry", "Cosmetic Dentistry"],
  countryCode: "KE",
  subdivisionCode: "NAIROBI",
  rating: 4.8,
  reviewCount: 37,
  amount: "2500.00",
  currency: "KES",
  openNow: true,
  phone: "+254 711 000 111",
  verificationTier: "verified",
};

function mockFeatured(overrides: Partial<ReturnType<typeof useHomeFeatured>> = {}) {
  vi.mocked(useHomeFeatured).mockReturnValue({
    listings: [clinic],
    hasLoaded: true,
    isPending: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useHomeFeatured>);
}

function renderSection() {
  return render(
    <MemoryRouter>
      <FeaturedClinics />
    </MemoryRouter>,
  );
}

describe("FeaturedClinics", () => {
  it("renders nothing while the market is still loading", () => {
    mockFeatured({ listings: [], hasLoaded: false, isPending: true });
    const { container } = renderSection();

    expect(container).toBeEmptyDOMElement();
  });

  it("links each featured clinic to its profile", () => {
    mockFeatured();
    renderSection();

    expect(screen.getByRole("link", { name: /SmileCare Dental/ })).toHaveAttribute(
      "href",
      "/dentists/p1",
    );
    expect(screen.getByText("Practice")).toBeInTheDocument();
    expect(screen.getByText("General Dentistry · Cosmetic Dentistry")).toBeInTheDocument();
    expect(screen.getByText("NAIROBI")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it("shows a specialist card with its workplace instead of specialties", () => {
    mockFeatured({
      listings: [
        {
          ...clinic,
          id: "s1",
          listingType: "specialist",
          name: "Dr. Amina Otieno",
          specialtyCodes: [],
          specialties: [],
          clinic: "SmileCare Dental",
          verificationTier: null,
        },
      ],
    });
    renderSection();

    expect(screen.getByRole("link", { name: /Dr. Amina Otieno/ })).toHaveAttribute(
      "href",
      "/dentists/s1",
    );
    expect(screen.getByText("Specialist")).toBeInTheDocument();
    expect(screen.getByText("SmileCare Dental")).toBeInTheDocument();
    expect(screen.queryByText("Verified")).not.toBeInTheDocument();
  });

  it("shows an empty state when the market has no listings yet", () => {
    mockFeatured({ listings: [] });
    renderSection();

    expect(screen.getByRole("heading", { name: /Featured Clinics/ })).toBeInTheDocument();
    expect(screen.getByText(/No clinics listed in Kenya yet/)).toBeInTheDocument();
  });
});
