import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import App from "./App";

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
});
