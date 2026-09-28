import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCountryConfig } from "../../hooks/useCountryConfig";
import HeroSection from "./HeroSection";

vi.mock("../../hooks/useCountryConfig", () => ({ useCountryConfig: vi.fn() }));

function mockCountry(insuranceEnabled: boolean) {
  vi.mocked(useCountryConfig).mockReturnValue({
    subdivisionLabel: "County",
    insuranceEnabled,
    insuranceSchemeLabel: "NHIF",
  } as unknown as ReturnType<typeof useCountryConfig>);
}

function renderHero() {
  return render(
    <MemoryRouter>
      <HeroSection />
    </MemoryRouter>,
  );
}

describe("HeroSection", () => {
  beforeEach(() => mockCountry(true));

  it("leads with Find a Dentist and offers the shop as the secondary path", () => {
    renderHero();

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Find a Dentist" })).toHaveAttribute(
      "href",
      "/dentists",
    );
    expect(screen.getByRole("link", { name: "Shop" })).toHaveAttribute("href", "/shop");
  });

  it("names the local insurer in the capability row when insurance is enabled", () => {
    renderHero();

    const row = screen.getByRole("list", { name: "What you can do" });
    expect(within(row).getByText("Search by county & specialty")).toBeInTheDocument();
    expect(within(row).getByText("Filter by NHIF")).toBeInTheDocument();
  });

  it("falls back to ratings when the country has no insurance feature", () => {
    mockCountry(false);
    renderHero();

    const row = screen.getByRole("list", { name: "What you can do" });
    expect(within(row).getByText("Compare ratings & reviews")).toBeInTheDocument();
    expect(within(row).queryByText(/Filter by/)).not.toBeInTheDocument();
  });

  it("frames the fixture dentist as an example and keeps the portrait decorative", () => {
    const { container } = renderHero();

    expect(screen.getAllByText("Example").length).toBeGreaterThan(0);
    for (const img of container.querySelectorAll("img")) {
      expect(img).toHaveAttribute("alt", "");
    }
  });
});
