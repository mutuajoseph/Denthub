import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DentistProfile } from "./DentistProfile";

function renderProfile(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dentists/:id" element={<DentistProfile />} />
        <Route path="/dentist/:id" element={<DentistProfile />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("DentistProfile", () => {
  it.each(["/dentists/sp-1", "/dentist/sp-1"])("looks up a fixture from %s", (path) => {
    renderProfile(path);

    expect(screen.getByRole("heading", { name: "Dr. Wanjiku Kamau" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /call smilecare dental centre/i })).toHaveAttribute(
      "href",
      "tel:+254712345678",
    );
  });

  it("offers a useful not-found state and a route back to search", () => {
    renderProfile("/dentists/unknown-provider");

    expect(screen.getByRole("heading", { name: "Dental provider not found" })).toBeInTheDocument();
    expect(screen.getByText(/we could not find “unknown-provider”/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to dentist search/i })).toHaveAttribute(
      "href",
      "/find-dentist",
    );
  });

  it("previews an appointment request without claiming it was sent or saved", async () => {
    const user = userEvent.setup();
    renderProfile("/dentists/sp-1");

    await user.click(screen.getByRole("button", { name: /preview appointment request/i }));
    expect(screen.getByText(/preview only.*nothing is sent or saved/i)).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: /patient name/i }), "Amina Patient");
    await user.type(screen.getByRole("textbox", { name: /email address/i }), "amina@example.com");
    await user.type(screen.getByLabelText(/preferred date/i), "2027-02-10");
    await user.click(screen.getByRole("button", { name: "Preview request" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      /preview ready.*nothing was sent or saved/i,
    );
    expect(screen.getByText("Amina Patient")).toBeInTheDocument();
    expect(screen.queryByText(/request sent/i)).not.toBeInTheDocument();
  });
});
