import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Emergency } from "./Emergency";

function renderPage() {
  return render(
    <MemoryRouter>
      <Emergency />
    </MemoryRouter>,
  );
}

describe("Emergency", () => {
  it("shows only fixture listings marked open now with direct call links", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Open dental listings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dr. Wanjiku Kamau" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Dr. James Ochieng" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /call Dr\. Wanjiku Kamau/i })).toHaveAttribute(
      "href",
      "tel:+254712345678",
    );
  });

  it("offers urgent-care guidance without diagnosis or triage claims", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: /if your symptoms feel urgent/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/contact your local emergency service/i)).toBeInTheDocument();
    expect(screen.getByText(/does not diagnose symptoms or assess urgency/i)).toBeInTheDocument();
    expect(screen.queryByText(/start triage/i)).not.toBeInTheDocument();
  });
});
