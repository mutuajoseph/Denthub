import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { useAnnouncementStore } from "../../store/announcementStore";
import { AnnouncementBar } from "./AnnouncementBar";

function renderAnnouncement() {
  return render(
    <MemoryRouter>
      <AnnouncementBar />
    </MemoryRouter>,
  );
}

describe("AnnouncementBar", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAnnouncementStore.setState({ dismissed: false });
  });

  it("keeps a dismissal after the bar is remounted", () => {
    const firstRender = renderAnnouncement();
    expect(screen.getByRole("complementary", { name: "Site announcement" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss announcement" }));
    expect(
      screen.queryByRole("complementary", { name: "Site announcement" }),
    ).not.toBeInTheDocument();

    firstRender.unmount();
    renderAnnouncement();
    expect(
      screen.queryByRole("complementary", { name: "Site announcement" }),
    ).not.toBeInTheDocument();
  });
});
