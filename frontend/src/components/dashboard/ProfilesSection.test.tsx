import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthUser } from "../../lib/auth";
import { addProfile } from "../../lib/meApi";
import { ProfilesSection } from "./ProfilesSection";

vi.mock("../../lib/meApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/meApi")>();
  return { ...actual, addProfile: vi.fn() };
});

const addProfileMock = vi.mocked(addProfile);

const user: AuthUser = {
  id: "user-1",
  email: "amina@example.com",
  full_name: "Amina Yusuf",
  phone: null,
  home_country_code: null,
  role: "patient",
  is_staff: false,
  account_status: "active",
  email_verified: true,
  profiles: [{ kind: "patient" }],
  memberships: [],
};

function renderSection(onUpdated = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  });

  render(
    <QueryClientProvider client={client}>
      <ProfilesSection user={user} onUpdated={onUpdated} />
    </QueryClientProvider>,
  );

  return { onUpdated };
}

describe("ProfilesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks a held Profile and offers the missing kinds", () => {
    renderSection();

    expect(screen.getByText("Patient profile")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add specialist/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add supplier/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add training provider/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add patient/i })).not.toBeInTheDocument();
  });

  it("adds a missing Profile and reports the updated user", async () => {
    const events = userEvent.setup();
    const updated: AuthUser = {
      ...user,
      profiles: [{ kind: "patient" }, { kind: "specialist" }],
    };
    addProfileMock.mockResolvedValue(updated);
    const { onUpdated } = renderSection();

    await events.click(screen.getByRole("button", { name: /add specialist/i }));

    await waitFor(() => expect(addProfileMock).toHaveBeenCalledWith("specialist"));
    expect(onUpdated).toHaveBeenCalledWith(updated);
  });

  it("shows a duplicate Profile error", async () => {
    const events = userEvent.setup();
    addProfileMock.mockRejectedValue(new Error("This account already holds that Profile"));
    renderSection();

    await events.click(screen.getByRole("button", { name: /add specialist/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This account already holds that Profile",
    );
  });
});
