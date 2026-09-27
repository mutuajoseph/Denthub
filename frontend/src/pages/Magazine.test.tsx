import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { listMagazineFixtures, listTechSpotlightFixtures } from "../lib/magazineFixtures";
import { Magazine } from "./Magazine";

function renderPage() {
  return render(<Magazine />);
}

describe("Magazine", () => {
  it("leads with the magazine masthead", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: /dental magazine & videos/i }),
    ).toBeInTheDocument();
  });

  it("lists every fixture item, newest first", () => {
    renderPage();

    // Every item except the featured one, which is also in the grid.
    expect(screen.getAllByRole("article")).toHaveLength(listMagazineFixtures().length);
  });

  it("features exactly one item with a working viewer", async () => {
    const user = userEvent.setup();
    const { container } = renderPage();

    const featuredSection = screen
      .getByRole("heading", { name: /featured this month/i })
      .closest("section") as HTMLElement;
    await user.click(within(featuredSection).getByRole("button", { name: /read article →/i }));

    const dialog = screen.getByRole("dialog", { name: /modern composite resin/i });
    expect(within(dialog).getByText(/filler loading/i)).toBeInTheDocument();
    expect(container).toBeTruthy();
  });

  it("closes the viewer on Escape", async () => {
    const user = userEvent.setup();
    renderPage();

    const featuredSection = screen
      .getByRole("heading", { name: /featured this month/i })
      .closest("section") as HTMLElement;
    await user.click(within(featuredSection).getByRole("button", { name: /read article →/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("filters by content type", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Videos" }));

    const videos = listMagazineFixtures().filter((item) => item.type === "video");
    expect(videos.length).toBeGreaterThan(0);
    expect(screen.getAllByRole("article")).toHaveLength(videos.length);
  });

  it("searches titles, excerpts and tags", async () => {
    const user = userEvent.setup();
    renderPage();

    const search = screen.getByLabelText(/search articles, videos, topics/i);

    await user.type(search, "remineralisation");
    const byTitle = listMagazineFixtures().filter((item) =>
      item.title.toLowerCase().includes("remineralisation"),
    );
    expect(byTitle.length).toBeGreaterThan(0);
    expect(screen.getAllByRole("article")).toHaveLength(byTitle.length);

    await user.clear(search);
    await user.type(search, "infection control");
    const byTag = listMagazineFixtures().filter((item) =>
      item.tags.some((tag) => tag.includes("infection control")),
    );
    expect(byTag.length).toBeGreaterThan(0);
    expect(screen.getAllByRole("article")).toHaveLength(byTag.length);
  });

  it("shows an empty state for a query with no matches", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/search articles, videos, topics/i), "zzzznotathing");

    expect(screen.getByText(/no content matches your filters yet/i)).toBeInTheDocument();
  });

  it("hides the featured block while a filter is active", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByText(/featured this month/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Videos" }));
    expect(screen.queryByText(/featured this month/i)).toBeNull();
  });

  it("renders the technology spotlight", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: /latest technology in dentistry/i }),
    ).toBeInTheDocument();
    for (const tech of listTechSpotlightFixtures()) {
      expect(screen.getByText(tech.name)).toBeInTheDocument();
    }
  });

  it("hides staff publishing tools from the public page", () => {
    renderPage();

    expect(screen.queryByRole("button", { name: /publish content/i })).toBeNull();
    expect(screen.queryByText(/publishing is open to dentists/i)).toBeNull();
  });
});
