import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../lib/apiClient";
import { verifyEmail } from "../lib/auth";
import { VerifyEmail } from "./VerifyEmail";

vi.mock("../lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/auth")>();
  return { ...actual, verifyEmail: vi.fn() };
});

const verifyEmailMock = vi.mocked(verifyEmail);

function renderPage(path = "/verify-email?token=abc123") {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/verify-email" element={<VerifyEmail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("VerifyEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not spend the token until the user confirms", () => {
    renderPage();

    expect(screen.getByRole("button", { name: /confirm my email/i })).toBeInTheDocument();
    expect(verifyEmailMock).not.toHaveBeenCalled();
  });

  it("confirms the email with the token from the link", async () => {
    verifyEmailMock.mockResolvedValue();
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: /confirm my email/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(/your email is confirmed/i);
    expect(verifyEmailMock).toHaveBeenCalledWith("abc123");
  });

  it("explains a spent or expired link", async () => {
    verifyEmailMock.mockRejectedValue(
      new ApiError("This link is invalid or has expired", { status: 400 }),
    );
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: /confirm my email/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid or has expired/i);
  });

  it("says so when the link has no token", () => {
    renderPage("/verify-email");

    expect(screen.getByRole("alert")).toHaveTextContent(/missing its token/i);
    expect(screen.queryByRole("button", { name: /confirm my email/i })).not.toBeInTheDocument();
  });
});
