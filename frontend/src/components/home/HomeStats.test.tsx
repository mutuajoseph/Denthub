import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCountryConfig } from "../../hooks/useCountryConfig";
import { useHomeStats } from "../../hooks/useHome";
import { useRegion } from "../../hooks/useRegion";
import HomeStats from "./HomeStats";

vi.mock("../../hooks/useHome", () => ({ useHomeStats: vi.fn() }));
vi.mock("../../hooks/useCountryConfig", () => ({ useCountryConfig: vi.fn() }));
vi.mock("../../hooks/useRegion", () => ({ useRegion: vi.fn() }));

vi.mocked(useCountryConfig).mockReturnValue({
  apiCountry: "KE",
  subdivisionPlural: "Counties",
} as unknown as ReturnType<typeof useCountryConfig>);
vi.mocked(useRegion).mockReturnValue({
  locale: "en",
} as unknown as ReturnType<typeof useRegion>);

function mockStats(data: ReturnType<typeof useHomeStats>["data"]) {
  vi.mocked(useHomeStats).mockReturnValue({
    data,
  } as ReturnType<typeof useHomeStats>);
}

describe("HomeStats", () => {
  it("renders nothing until the market's stats have loaded", () => {
    mockStats(undefined);
    const { container } = render(<HomeStats />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders every figure straight from the query, formatted for the locale", () => {
    mockStats({
      country_code: "KE",
      clinics_listed: 2400,
      verified_clinics: 120,
      specialists: 340,
      counties_covered: 47,
    });
    render(<HomeStats />);

    expect(screen.getByText("Clinics listed")).toBeInTheDocument();
    expect(screen.getByText("2,400")).toBeInTheDocument();
    expect(screen.getByText("Verified clinics")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("Specialists")).toBeInTheDocument();
    expect(screen.getByText("340")).toBeInTheDocument();
    expect(screen.getByText("Counties covered")).toBeInTheDocument();
    expect(screen.getByText("47")).toBeInTheDocument();
  });
});
