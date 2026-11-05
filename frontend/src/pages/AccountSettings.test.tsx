import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROLE } from "../auth/roles";
import { ApiError } from "../lib/apiClient";
import {
  type AuthResponse,
  type AuthUser,
  changePassword,
  resendVerificationEmail,
} from "../lib/auth";
import { AccountSettings } from "./AccountSettings";

vi.mock("../lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/auth")>();
  return { ...actual, changePassword: vi.fn(), resendVerificationEmail: vi.fn() };
});

const changePasswordMock = vi.mocked(changePassword);
const resendVerificationEmailMock = vi.mocked(resendVerificationEmail);

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "user-1",
    email: "user@example.com",
    full_name: "Test User",
    role: ROLE.PATIENT,
    is_staff: false,
    account_status: "active",
    email_verified: true,
    profiles: [],
    memberships: [],
    ...overrides,
  };
}

const changedAuth: AuthResponse = {
  access_token: "fresh-token",
  token_type: "bearer",
  user: makeUser(),
};

function renderPage(user: AuthUser = makeUser(), onAuthChanged = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

  const utils = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AccountSettings user={user} onAuthChanged={onAuthChanged} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { ...utils, onAuthChanged };
}

async function fill(current: string, next: string, confirm: string) {
  await userEvent.type(screen.getByLabelText("Current password"), current);
  await userEvent.type(screen.getByLabelText("New password"), next);
  await userEvent.type(screen.getByLabelText("Confirm new password"), confirm);
  await userEvent.click(screen.getByRole("button", { name: /^change password$/i }));
}

describe("AccountSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the password form and no verification notice once verified", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: /account settings/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /resend verification email/i })).toBeNull();
  });

  it("stores the returned session and reports success", async () => {
    changePasswordMock.mockResolvedValue(changedAuth);
    const { onAuthChanged } = renderPage();

    await fill("old password", "a long new passphrase", "a long new passphrase");

    expect(await screen.findByRole("status")).toHaveTextContent(/password is changed/i);
    expect(changePasswordMock).toHaveBeenCalledWith("old password", "a long new passphrase");
    expect(onAuthChanged).toHaveBeenCalledWith(changedAuth);
  });

  it("disables the form while the change is in flight", async () => {
    changePasswordMock.mockImplementation(() => new Promise(() => undefined));
    renderPage();

    await fill("old password", "a long new passphrase", "a long new passphrase");

    expect(await screen.findByRole("button", { name: /saving/i })).toBeDisabled();
  });

  it("shows the API's error when the current password is wrong", async () => {
    changePasswordMock.mockRejectedValue(
      new ApiError("Current password is incorrect", { status: 400 }),
    );
    renderPage();

    await fill("wrong password", "a long new passphrase", "a long new passphrase");

    expect(await screen.findByRole("alert")).toHaveTextContent(/current password is incorrect/i);
  });

  it("refuses mismatched passwords without calling the API", async () => {
    renderPage();

    await fill("old password", "a long new passphrase", "something else entirely");

    expect(screen.getByRole("alert")).toHaveTextContent(/don't match/i);
    expect(changePasswordMock).not.toHaveBeenCalled();
  });

  it("offers a resend while the email is unverified", async () => {
    resendVerificationEmailMock.mockResolvedValue();
    renderPage(makeUser({ email_verified: false }));

    await userEvent.click(screen.getByRole("button", { name: /resend verification email/i }));

    expect(
      await screen.findByText(/we've sent a new verification link to user@example.com/i),
    ).toBeInTheDocument();
    expect(resendVerificationEmailMock).toHaveBeenCalledTimes(1);
  });

  it("hides the notice on a 409 instead of showing an error", async () => {
    resendVerificationEmailMock.mockRejectedValue(
      new ApiError("This email is already verified", { status: 409 }),
    );
    renderPage(makeUser({ email_verified: false }));

    await userEvent.click(screen.getByRole("button", { name: /resend verification email/i }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /resend verification email/i })).toBeNull(),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows any other resend error", async () => {
    resendVerificationEmailMock.mockRejectedValue(
      new ApiError("Mail is unavailable right now", { status: 503 }),
    );
    renderPage(makeUser({ email_verified: false }));

    await userEvent.click(screen.getByRole("button", { name: /resend verification email/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/mail is unavailable/i);
  });
});
