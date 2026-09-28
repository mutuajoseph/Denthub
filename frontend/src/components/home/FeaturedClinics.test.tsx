import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useCountryConfig } from "../../hooks/useCountryConfig";
import { useDentistSearch } from "../../hooks/useDentistSearch";
import FeaturedClinics from "./FeaturedClinics";

vi.mock("../../hooks/useDentistSearch", () => ({ useDentistSearch: vi.fn() }));
vi.mock("../../hooks/useCountryConfig", () => ({ useCountryConfig: vi.fn() }));

vi.mocked(useCountryConfig).mockReturnValue({
  insuranceSchemeLabel: "NHIF",
} as unknown as ReturnType<typeof useCountryConfig>);

function mockSearch(data: unknown) {
  vi.mocked(useDentistSearch).mockReturnValue({ data } as ReturnType<typeof useDentistSearch>);
}

function renderSection() {
  return render(
    <MemoryRouter>
      <FeaturedClinics />
    </MemoryRouter>,
  );
}

describe("FeaturedClinics", () => {
  it("renders nothing while the search API returns no listings", () => {
    mockSearch({ practices: [], specialists: [] });
    const { container } = renderSection();

    expect(container).toBeEmptyDOMElement();
  });

  it("links each featured practice to its profile", () => {
    mockSearch({
      practices: [
        {
          id: "p1",
          listingType: "practice",
          name: "SmileCare Dental",
          specialty: ["General", "Cosmetic"],
          operatingAreas: ["Westlands"],
          county: "Nairobi",
          town: "Westlands",
          rating: 4.8,
          reviews: 12,
          nhif: true,
          insurance: [],
          verified: true,
          approved: true,
        },
      ],
      specialists: [],
    });
    renderSection();

    expect(screen.getByRole("link", { name: /SmileCare Dental/ })).toHaveAttribute(
      "href",
      "/dentists/p1",
    );
    expect(screen.getByText("NHIF")).toBeInTheDocument();
  });
});
