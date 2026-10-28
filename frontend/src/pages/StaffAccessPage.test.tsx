import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../lib/apiClient";
import { type AuthResponse, loginStaff } from "../lib/auth";
import { StaffAccessPage } from "./StaffAccessPage";

vi.mock("../lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/auth")>();
  return { ...actual, loginStaff: vi.fn() };
});

const loginStaffMock = vi.mocked(loginStaff);

const staffAuth: AuthResponse = {
  access_token: "staff-token",
  token_type: "bearer",
  user: {
    id: "staff-1",
    email: "admin@example.com",
    full_name: "Platform Admin",
    role: "admin",
    is_staff: true,
    account_status: "active",
    email_verified: true,
    profiles: [],
    memberships: [],
  },
};

function renderPage(onSuccess = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={["/staff/access"]}>
      <Routes>
        <Route path="/staff/access" element={<StaffAccessPage onSuccess={onSuccess} />} />
        <Route path="/" element={<p>Home</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("StaffAccessPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("presents a standalone staff surface, not the public login", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: /staff sign in/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /register/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /google/i })).not.toBeInTheDocument();
  });

  it("signs in through the staff endpoint and reports success", async () => {
    loginStaffMock.mockResolvedValue(staffAuth);
    const onSuccess = vi.fn();

    renderPage(onSuccess);

    await userEvent.type(screen.getByLabelText(/^Email$/i), "admin@example.com");
    await userEvent.type(screen.getByLabelText(/^Password$/i), "secret-password");
    await userEvent.click(screen.getByRole("button", { name: /sign in to staff console/i }));

    await waitFor(() => {
      expect(loginStaffMock).toHaveBeenCalledWith({
        email: "admin@example.com",
        password: "secret-password",
      });
    });
    expect(onSuccess).toHaveBeenCalledWith(staffAuth);
  });

  it("shows the rejection message when a public account tries the staff surface", async () => {
    loginStaffMock.mockRejectedValue(
      new ApiError("This account may not sign in at the staff surface", {
        status: 403,
        code: "FORBIDDEN",
      }),
    );

    renderPage();

    await userEvent.type(screen.getByLabelText(/^Email$/i), "patient@example.com");
    await userEvent.type(screen.getByLabelText(/^Password$/i), "secret-password");
    await userEvent.click(screen.getByRole("button", { name: /sign in to staff console/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /may not sign in at the staff surface/i,
    );
  });
});
