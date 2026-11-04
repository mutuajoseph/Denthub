import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthUser } from "../../lib/auth";
import { type CountryListWire, fetchCountries } from "../../lib/countryConfigApi";
import { updateMe } from "../../lib/meApi";
import { AccountDetailsSection } from "./AccountDetailsSection";

vi.mock("../../lib/countryConfigApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/countryConfigApi")>();
  return { ...actual, fetchCountries: vi.fn() };
});

vi.mock("../../lib/meApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/meApi")>();
  return { ...actual, updateMe: vi.fn() };
});

const fetchCountriesMock = vi.mocked(fetchCountries);
const updateMeMock = vi.mocked(updateMe);

const user: AuthUser = {
  id: "user-1",
  email: "amina@example.com",
  full_name: "Amina Yusuf",
  phone: null,
  home_country_code: null,
  role: "patient",
  is_staff: false,
  account_status: "active",
  profiles: [{ kind: "patient" }],
  memberships: [],
};

const countries: CountryListWire = {
  items: [
    {
      code: "KE",
      name: "Kenya",
      currency: "KES",
      currency_symbol: "KSh",
      locale: "en-KE",
      timezone: "Africa/Nairobi",
      subdivision_label: "County",
      subdivision_label_plural: "Counties",
    },
  ],
  default_country_code: "KE",
};

function renderSection(onUpdated = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  });

  render(
    <QueryClientProvider client={client}>
      <AccountDetailsSection user={user} onUpdated={onUpdated} />
    </QueryClientProvider>,
  );

  return { onUpdated };
}

describe("AccountDetailsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchCountriesMock.mockResolvedValue(countries);
  });

  it("saves the name, phone, and home Country", async () => {
    const events = userEvent.setup();
    const updated = {
      ...user,
      full_name: "Amina Updated",
      phone: "+254700000000",
      home_country_code: "KE",
    };
    updateMeMock.mockResolvedValue(updated);

    const { onUpdated } = renderSection();

    await userEvent.clear(screen.getByLabelText("Name"));
    await events.type(screen.getByLabelText("Name"), "Amina Updated");
    await events.type(screen.getByLabelText("Phone"), "+254700000000");
    await events.selectOptions(screen.getByLabelText("Home country"), "KE");
    await events.click(screen.getByRole("button", { name: /save details/i }));

    await waitFor(() =>
      expect(updateMeMock).toHaveBeenCalledWith({
        full_name: "Amina Updated",
        phone: "+254700000000",
        home_country_code: "KE",
      }),
    );
    expect(onUpdated).toHaveBeenCalledWith(updated);
    expect(await screen.findByRole("status")).toHaveTextContent("Account details saved.");
  });

  it("can clear an optional phone and home Country", async () => {
    const events = userEvent.setup();
    updateMeMock.mockResolvedValue(user);
    renderSection();

    await events.click(screen.getByRole("button", { name: /save details/i }));

    await waitFor(() =>
      expect(updateMeMock).toHaveBeenCalledWith({
        full_name: "Amina Yusuf",
        phone: null,
        home_country_code: null,
      }),
    );
  });

  it("disables saving when the name is blank", async () => {
    renderSection();

    await userEvent.clear(screen.getByLabelText("Name"));

    expect(screen.getByRole("button", { name: /save details/i })).toBeDisabled();
    expect(updateMeMock).not.toHaveBeenCalled();
  });

  it("surfaces a save failure", async () => {
    const events = userEvent.setup();
    updateMeMock.mockRejectedValue(new Error("Unknown or inactive home Country"));
    renderSection();

    await events.click(screen.getByRole("button", { name: /save details/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Unknown or inactive home Country");
  });
});
