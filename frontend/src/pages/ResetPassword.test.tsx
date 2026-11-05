import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../lib/apiClient";
import { resetPassword } from "../lib/auth";
import { ResetPassword } from "./ResetPassword";

vi.mock("../lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/auth")>();
  return { ...actual, resetPassword: vi.fn() };
});

const resetPasswordMock = vi.mocked(resetPassword);

function renderPage(path = "/reset-password?token=tok-1") {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function fill(password: string, confirm: string) {
  await userEvent.type(screen.getByLabelText("New password"), password);
  await userEvent.type(screen.getByLabelText("Confirm new password"), confirm);
  await userEvent.click(screen.getByRole("button", { name: /set new password/i }));
}

describe("ResetPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets the new password with the token from the link", async () => {
    resetPasswordMock.mockResolvedValue();
    renderPage();

    await fill("a long new passphrase", "a long new passphrase");

    expect(await screen.findByRole("status")).toHaveTextContent(/password is changed/i);
    expect(resetPasswordMock).toHaveBeenCalledWith("tok-1", "a long new passphrase");
  });

  it("refuses mismatched passwords without calling the API", async () => {
    renderPage();

    await fill("a long new passphrase", "something else entirely");

    expect(screen.getByRole("alert")).toHaveTextContent(/don't match/i);
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });

  it("explains a spent or expired link", async () => {
    resetPasswordMock.mockRejectedValue(
      new ApiError("This link is invalid or has expired", { status: 400 }),
    );
    renderPage();

    await fill("a long new passphrase", "a long new passphrase");

    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid or has expired/i);
  });

  it("says so when the link has no token", () => {
    renderPage("/reset-password");

    expect(screen.getByRole("alert")).toHaveTextContent(/missing its token/i);
  });
});
