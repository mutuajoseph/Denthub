import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import App from "./App";
import { NAV_LINKS } from "./components/Navbar";
import { getPageMeta } from "./hooks/usePageMeta";

function renderApp(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("App routes", () => {
  it("renders the home page at /", () => {
    const { container } = renderApp("/");

    expect(container.querySelector("#hero-heading")).not.toBeNull();
  });

  it.each(["/dentists", "/find-dentist"])("renders dentist discovery at %s", (path) => {
    renderApp(path);

    expect(
      screen.getByRole("heading", { name: /find the right dental care/i }),
    ).toBeInTheDocument();
  });

  it.each(["/dentists/sp-1", "/dentist/sp-1"])("renders a profile at %s", (path) => {
    renderApp(path);

    expect(screen.getByRole("heading", { name: /dr\. wanjiku kamau/i })).toBeInTheDocument();
  });

  it("renders the international patient page", () => {
    renderApp("/international");

    expect(screen.getByRole("heading", { name: /plan your dental journey/i })).toBeInTheDocument();
  });

  it("renders the emergency page", () => {
    renderApp("/emergency");

    expect(
      screen.getByRole("heading", { name: /find emergency dental care now/i }),
    ).toBeInTheDocument();
  });

  it("renders NotFound for unknown routes", () => {
    renderApp("/definitely-not-a-page");

    expect(screen.getByRole("heading", { name: /page not found/i })).toBeInTheDocument();
  });

  // Regression guard: every public navbar link used to fall through to NotFound.
  it.each(NAV_LINKS.map((link) => [link.label, link.href] as const))(
    "routes the %s nav link (%s) to a real page",
    (_label, href) => {
      renderApp(href);

      expect(screen.queryByRole("heading", { name: /page not found/i })).toBeNull();
    },
  );

  it("keeps dedicated page metadata for every non-home nav route", () => {
    // "/" intentionally reuses the home metadata, so it is excluded here.
    const nonHome = NAV_LINKS.filter((link) => link.href !== "/");
    expect(nonHome.length).toBeGreaterThan(0);

    for (const link of nonHome) {
      expect(getPageMeta(link.href, "DentHub").title).not.toMatch(/Complete Dental Platform/);
    }
  });
});
