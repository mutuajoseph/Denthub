import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../lib/apiClient";
import { requestPasswordReset } from "../lib/auth";
import { ForgotPassword } from "./ForgotPassword";

vi.mock("../lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/auth")>();
  return { ...actual, requestPasswordReset: vi.fn() };
});

const requestMock = vi.mocked(requestPasswordReset);

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ForgotPassword onBack={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe("ForgotPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests a reset link and shows the server's answer", async () => {
    requestMock.mockResolvedValue({
      message: "If that email has a DentHub account, we've sent a reset link to it.",
    });
    renderForm();

    await userEvent.type(screen.getByLabelText("Email"), "amina@example.com");
    await userEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(/if that email has/i);
    expect(requestMock).toHaveBeenCalledWith("amina@example.com");
  });

  it("shows a failure without claiming an email was sent", async () => {
    requestMock.mockRejectedValue(new ApiError("Cannot reach the API.", { status: 0 }));
    renderForm();

    await userEvent.type(screen.getByLabelText("Email"), "amina@example.com");
    await userEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/cannot reach the api/i);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
