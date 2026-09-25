import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { EmergencyFAB } from "./EmergencyFAB";

describe("EmergencyFAB", () => {
  it("navigates to emergency care", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<EmergencyFAB />} />
          <Route path="/emergency" element={<p>Emergency care page</p>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Emergency dental care" }));
    expect(screen.getByText("Emergency care page")).toBeInTheDocument();
  });
});
