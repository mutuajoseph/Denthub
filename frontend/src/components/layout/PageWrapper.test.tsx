import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { PageWrapper } from "./PageWrapper";

vi.mock("../../lib/countryConfigApi", () => ({
  fetchCountries: vi.fn().mockResolvedValue({ items: [], default_country_code: "KE" }),
  fetchCountryConfig: vi.fn(),
  fetchSpecialties: vi.fn(),
}));

function newClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  });
}

describe("PageWrapper", () => {
  it("renders a skip link and the routed main landmark", () => {
    render(
      <QueryClientProvider client={newClient()}>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route element={<PageWrapper />}>
              <Route index element={<p>Route content</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute(
      "href",
      "#main-content",
    );
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByText("Route content")).toBeInTheDocument();
  });
});
