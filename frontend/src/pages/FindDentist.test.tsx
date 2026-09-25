import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { FindDentist } from "./FindDentist";

function renderPage() {
  return render(
    <MemoryRouter>
      <FindDentist />
    </MemoryRouter>,
  );
}

describe("FindDentist", () => {
  it("searches fixture listings and links to the target profile shape", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByRole("searchbox", { name: /search dentists/i }), "Wanjiku");

    expect(screen.getByText("1 result")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dr. Wanjiku Kamau" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View profile for Dr. Wanjiku Kamau" }),
    ).toHaveAttribute("href", "/dentists/sp-1");
    expect(screen.queryByRole("heading", { name: "Eldoret Dental Hub" })).not.toBeInTheDocument();
  });

  it("combines country, subdivision, listing, specialty, insurance, rating, and open-now filters", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(screen.getByRole("combobox", { name: /country/i }), "NG");
    await user.selectOptions(
      screen.getByRole("combobox", { name: /region or subdivision/i }),
      "Lagos",
    );
    await user.selectOptions(screen.getByRole("combobox", { name: /listing type/i }), "specialist");
    await user.selectOptions(screen.getByRole("combobox", { name: /specialty/i }), "Implants");
    await user.selectOptions(screen.getByRole("combobox", { name: /insurance/i }), "NHIS");
    await user.click(screen.getByRole("checkbox", { name: /open now/i }));
    fireEvent.change(screen.getByRole("slider", { name: /minimum rating/i }), {
      target: { value: "4.7" },
    });

    expect(screen.getByText("1 result")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dr. Ada Okafor" })).toBeInTheDocument();
  });

  it("supports deterministic sorting, view changes, and a recoverable empty state", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(screen.getByRole("combobox", { name: /sort results/i }), "name_asc");
    const profileLinks = screen.getAllByRole("link", { name: /^View profile for/ });
    expect(profileLinks[0]).toHaveAttribute("href", "/dentists/pr-3");

    const listButton = screen.getByRole("button", { name: "List view" });
    await user.click(listButton);
    expect(listButton).toHaveAttribute("aria-pressed", "true");

    await user.type(
      screen.getByRole("searchbox", { name: /search dentists/i }),
      "no-such-provider",
    );
    expect(screen.getByRole("heading", { name: "No dental providers match" })).toBeInTheDocument();
    expect(screen.getByText(/try a broader location/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(screen.getByText("17 results")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dr. Wanjiku Kamau" })).toBeInTheDocument();
  });
});
