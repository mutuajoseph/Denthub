import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthUser } from "../lib/auth";
import { useRegionStore } from "../store/regionStore";
import Navbar from "./Navbar";

vi.mock("../lib/countryConfigApi", () => ({
  fetchCountries: vi.fn().mockResolvedValue({ items: [], default_country_code: "KE" }),
  fetchCountryConfig: vi.fn(),
  fetchSpecialties: vi.fn(),
}));

const patient: AuthUser = {
  id: "me",
  email: "amina@example.com",
  role: "patient",
  full_name: "Amina Wanjiku",
  is_staff: false,
  account_status: "active",
};

const admin: AuthUser = {
  id: "staff",
  email: "admin@example.com",
  role: "admin",
  full_name: "Platform Admin",
  is_staff: true,
  account_status: "active",
};

function renderNavbar(user: AuthUser) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Navbar onSignIn={vi.fn()} user={user} onLogout={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function openAccountMenu(user: AuthUser) {
  const account = userEvent.setup();
  await account.click(screen.getByRole("button", { name: `Account menu for ${user.full_name}` }));
  return account;
}

describe("Navbar account menu", () => {
  beforeEach(() => {
    useRegionStore.getState().setRegion("KE");
  });

  it("restores the Messages entry for a public account", async () => {
    renderNavbar(patient);
    await openAccountMenu(patient);

    expect(screen.getByRole("menuitem", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByRole("menuitem", { name: "Messages" })).toHaveAttribute("href", "/messages");
  });

  it("gives a staff account no account destinations", async () => {
    renderNavbar(admin);
    await openAccountMenu(admin);

    expect(screen.queryByRole("menuitem", { name: "Messages" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Dashboard" })).toBeNull();
  });
});
