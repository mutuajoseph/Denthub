import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { register } from "../lib/auth";
import type { CountryConfig } from "../lib/countryConfigApi";
import { useRegionStore } from "../store/regionStore";
import Register from "./Register";

const keConfig: CountryConfig = {
  code: "KE",
  name: "Kenya",
  currency: "KES",
  currencySymbol: "KSh",
  locale: "en-KE",
  geography: { subdivisionLabel: "County", subdivisionPlural: "Counties", cityLabel: "Town" },
  features: {},
  featureConfigs: {},
  featureContexts: {},
  insuranceProviders: [],
  regions: [
    { id: "KE-NAIROBI", code: "NAIROBI", name: "Nairobi", countryCode: "KE" },
    { id: "KE-MOMBASA", code: "MOMBASA", name: "Mombasa", countryCode: "KE" },
  ],
};

vi.mock("../lib/auth", () => ({ register: vi.fn() }));
vi.mock("../lib/countryConfigApi", () => ({
  fetchCountryConfig: vi.fn(async () => keConfig),
}));

async function fillAccount(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Full name"), "Achieng Otieno");
  await user.type(screen.getByLabelText("Email"), "owner@example.com");
  await user.type(screen.getByLabelText("Password"), "correct horse battery staple");
}

function renderRegister() {
  render(<Register onClose={vi.fn()} onSignIn={vi.fn()} />);
}

describe("Register", () => {
  beforeEach(() => {
    vi.mocked(register).mockReset();
    vi.mocked(register).mockResolvedValue({} as never);
    useRegionStore.setState({ regionCode: "KE", hasManualSelection: true });
  });

  it("asks a clinic for its name, county and address and sends them as its Facility", async () => {
    const user = userEvent.setup();
    renderRegister();

    await user.click(screen.getByRole("button", { name: /clinic \/ employer/i }));
    await fillAccount(user);
    await user.type(screen.getByLabelText("Clinic name"), "Smile Line Dental");
    await user.selectOptions(await screen.findByLabelText("County"), "MOMBASA");
    await user.type(screen.getByLabelText("Clinic address"), "Nyali Road, Mombasa");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({
        account_type: "facility_owner",
        facility: {
          name: "Smile Line Dental",
          subdivision_code: "MOMBASA",
          address: "Nyali Road, Mombasa",
        },
      }),
    );
  });

  it("asks a patient for no Facility details and sends none", async () => {
    const user = userEvent.setup();
    renderRegister();

    await user.click(screen.getByRole("button", { name: /^patient/i }));

    expect(screen.queryByLabelText("Clinic name")).not.toBeInTheDocument();
    await fillAccount(user);
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(register).toHaveBeenCalledOnce();
    expect(vi.mocked(register).mock.calls[0][0]).not.toHaveProperty("facility");
  });
});
