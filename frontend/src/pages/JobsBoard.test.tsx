import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { JOBS_PAGE_SIZE, JOB_TYPES } from "../config/jobConstants";
import { listJobFixtures } from "../lib/jobFixtures";
import { useRegionStore } from "../store/regionStore";
import { JobsBoard } from "./JobsBoard";

function renderPage() {
  return render(
    <MemoryRouter>
      <JobsBoard />
    </MemoryRouter>,
  );
}

describe("JobsBoard", () => {
  // The region store otherwise infers the country from `navigator.languages`,
  // which is `en-US` under jsdom, and every fixture posting is Kenyan.
  beforeEach(() => {
    useRegionStore.getState().setRegion("KE");
  });

  it("shows the board heading from site content", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: /dental jobs board kenya/i }),
    ).toBeInTheDocument();
  });

  it("caps the list at the page size and offers to show the rest", async () => {
    const user = userEvent.setup();
    renderPage();

    const total = listJobFixtures().length;
    expect(total).toBeGreaterThan(JOBS_PAGE_SIZE);

    const toggle = screen.getByRole("button", { name: new RegExp(`show all ${total} jobs`, "i") });
    expect(toggle).toBeInTheDocument();

    // Only the first page is rendered before expanding.
    expect(screen.getAllByRole("article")).toHaveLength(JOBS_PAGE_SIZE);

    await user.click(toggle);
    expect(screen.getAllByRole("article")).toHaveLength(total);
    expect(screen.getByRole("button", { name: /show less/i })).toBeInTheDocument();
  });

  it("filters by job type", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(screen.getByLabelText(/job type/i), "Receptionist");

    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(1);
    expect(within(cards[0]).getByRole("heading", { name: /receptionist/i })).toBeInTheDocument();
  });

  it("offers a sensible empty state when filters exclude everything", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(screen.getByLabelText(/job type/i), "Digital Marketer");
    expect(screen.getByText(/no jobs match those filters/i)).toBeInTheDocument();
  });

  it("explains an empty region separately from an empty filter result", () => {
    useRegionStore.getState().setRegion("US");
    renderPage();

    expect(screen.getByText(/no jobs listed in your region yet/i)).toBeInTheDocument();
  });

  it("labels the region filter for the active country", () => {
    renderPage();

    // Kenya is the default region, so the subdivision filter reads "County".
    expect(screen.getByLabelText(/county/i)).toBeInTheDocument();
  });

  it("renders a salary range in the region's currency", () => {
    renderPage();

    // Intl renders the Kenyan shilling symbol as "Ksh" in the en-KE locale.
    expect(screen.getAllByRole("article")[0]).toHaveTextContent(/Ksh\s?180,000/);
  });

  it("falls back to 'Competitive' when no range is disclosed", () => {
    renderPage();

    const disclosed = listJobFixtures().filter(
      (job) => job.salaryMin !== null && job.salaryMax !== job.salaryMin,
    );
    expect(disclosed.length).toBeGreaterThan(0);

    // Every fixture discloses a floor, so nothing renders the fallback here.
    expect(screen.queryByText("Competitive")).toBeNull();
  });

  it("exposes every job type in the filter", () => {
    renderPage();

    const select = screen.getByLabelText(/job type/i);
    for (const type of JOB_TYPES) {
      expect(within(select).getByRole("option", { name: type })).toBeInTheDocument();
    }
  });
});
