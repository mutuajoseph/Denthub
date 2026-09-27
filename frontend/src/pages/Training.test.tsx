import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { listCourseFixtures, listWebinarFixtures } from "../lib/courseFixtures";
import { Training } from "./Training";

function renderPage() {
  return render(<Training />);
}

describe("Training", () => {
  it("shows the training heading from site content", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: /skills & cpd training/i }),
    ).toBeInTheDocument();
  });

  it("lists every course and webinar fixture", () => {
    renderPage();

    expect(screen.getAllByRole("article")).toHaveLength(listCourseFixtures().length);

    const webinars = screen
      .getByRole("heading", {
        name: /upcoming live webinars/i,
      })
      .closest("section");
    expect(within(webinars as HTMLElement).getAllByRole("listitem")).toHaveLength(
      listWebinarFixtures().length,
    );
  });

  it("filters courses by delivery format", async () => {
    const user = userEvent.setup();
    renderPage();

    const online = listCourseFixtures().filter((course) => course.format === "online");
    expect(online.length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Online" }));
    expect(screen.getAllByRole("article")).toHaveLength(online.length);
  });

  it("filters courses by specialty and toggles the filter off again", async () => {
    const user = userEvent.setup();
    renderPage();

    const target = "Periodontics";
    const expected = listCourseFixtures().filter((course) => course.specialty === target);
    expect(expected).toHaveLength(1);

    const filter = screen.getByRole("button", { name: target });
    await user.click(filter);
    expect(filter).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("article")).toHaveLength(1);

    await user.click(filter);
    expect(filter).toHaveAttribute("aria-pressed", "false");
    expect(screen.getAllByRole("article")).toHaveLength(listCourseFixtures().length);
  });

  it("combines format and specialty filters into an empty state", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Online" }));
    await user.click(screen.getByRole("button", { name: "Oral Surgery" }));

    expect(screen.getByText(/no courses match those filters yet/i)).toBeInTheDocument();
  });

  it("hides provider-only authoring tools from the public page", () => {
    renderPage();

    expect(screen.queryByRole("button", { name: /publish/i })).toBeNull();
    expect(screen.queryByText(/training provider/i)).toBeNull();
  });

  it("shows the CPD certificate preview", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: /cpd certificate preview/i })).toBeInTheDocument();
    expect(screen.getByText("12 CPD Points")).toBeInTheDocument();
  });
});
