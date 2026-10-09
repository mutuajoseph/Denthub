import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchHomeFeatured, fetchHomeStats } from "../lib/homeApi";
import type { DentistListing } from "../lib/listingApi";
import { useHomeFeatured, useHomeStats } from "./useHome";
import { useSpecialties } from "./useSpecialties";

vi.mock("../lib/homeApi", () => ({
  fetchHomeFeatured: vi.fn(),
  fetchHomeStats: vi.fn(),
}));
vi.mock("./useSpecialties", () => ({ useSpecialties: vi.fn() }));

vi.mocked(useSpecialties).mockReturnValue({
  nameOf: () => "",
} as unknown as ReturnType<typeof useSpecialties>);

const listingWire: DentistListing = {
  id: "f1",
  listing_type: "facility",
  name: "Smile Care",
  country_code: "KE",
  subdivision_code: "NAIROBI",
  specialty_codes: [],
  rating: "4.8",
  review_count: 3,
  list_price: null,
  currency: "KES",
  open_now: true,
  phone: null,
  verification_tier: "verified",
  clinic_name: null,
};

vi.mocked(fetchHomeStats).mockImplementation((country) =>
  Promise.resolve({
    country_code: country,
    clinics_listed: 2,
    verified_clinics: 1,
    specialists: 1,
    counties_covered: 2,
  }),
);
vi.mocked(fetchHomeFeatured).mockImplementation((country) =>
  Promise.resolve({
    items: [{ ...listingWire, country_code: country }],
    country_code: country,
    currency: country === "KE" ? "KES" : "NGN",
  }),
);

function Harness({ country }: { country: string }) {
  const stats = useHomeStats(country);
  const featured = useHomeFeatured(country);

  return (
    <output>
      <span>{stats.data?.country_code ?? "none"}</span>
      <span>{featured.listings[0]?.name ?? "none"}</span>
    </output>
  );
}

function renderFor(country: string, client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <Harness country={country} />
    </QueryClientProvider>,
  );
}

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe("useHome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refetches stats and featured listings when the country changes", async () => {
    const client = createQueryClient();
    const { rerender } = renderFor("KE", client);

    await waitFor(() => expect(screen.getByText("KE")).toBeInTheDocument());
    expect(fetchHomeStats).toHaveBeenCalledWith("KE", expect.anything());

    rerender(
      <QueryClientProvider client={client}>
        <Harness country="NG" />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByText("NG")).toBeInTheDocument());
    expect(fetchHomeStats).toHaveBeenCalledWith("NG", expect.anything());
    expect(fetchHomeFeatured).toHaveBeenCalledWith("NG", expect.anything());
  });
});
