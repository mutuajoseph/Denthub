import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { About } from "./About";

function renderPage() {
  return render(
    <MemoryRouter>
      <About />
    </MemoryRouter>,
  );
}

describe("About", () => {
  it("introduces DentHub as a dental ecosystem", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: /building the future of dental care/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/connects patients, dentists, clinics, suppliers/i),
    ).toBeInTheDocument();
  });

  it("lists every network feature", () => {
    renderPage();

    for (const feature of [
      "Trusted Dental Network",
      "Built For Everyone",
      "Clinic Growth",
      "Learning & Training",
      "Quality First",
      "Connected Globally",
    ]) {
      expect(screen.getByRole("heading", { name: feature })).toBeInTheDocument();
    }
  });

  it("links only to real routes, so the hero CTAs cannot 404", () => {
    renderPage();

    const findDentist = screen.getByRole("link", { name: /find a dentist/i });
    const jobs = screen.getByRole("link", { name: /browse dental jobs/i });

    expect(findDentist).toHaveAttribute("href", "/dentists");
    expect(jobs).toHaveAttribute("href", "/jobs");
  });

  it("has no remote images, keeping the page self-contained", () => {
    const { container } = renderPage();

    expect(container.querySelector("img")).toBeNull();
  });
});
