import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AccountExportWire } from "../lib/accountApi";
import { deleteAccount, fetchAccountExport } from "../lib/accountApi";
import type { AuthUser } from "../lib/auth";
import { Settings } from "./Settings";

vi.mock("../lib/accountApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/accountApi")>();
  return { ...actual, fetchAccountExport: vi.fn(), deleteAccount: vi.fn() };
});

const fetchAccountExportMock = vi.mocked(fetchAccountExport);
const deleteAccountMock = vi.mocked(deleteAccount);

const patient: AuthUser = {
  id: "user-1",
  email: "patient@example.com",
  full_name: "Amina Yusuf",
  role: "patient",
  is_staff: false,
  account_status: "active",
  profiles: [{ kind: "patient" }],
  memberships: [],
};

const exportedAccount: AccountExportWire = {
  exported_at: "2026-10-29T09:30:00Z",
  user: {
    id: "user-1",
    full_name: "Amina Yusuf",
    email: "patient@example.com",
    phone: "+254712345678",
    role: "patient",
    is_staff: false,
    account_status: "active",
    facility_id: null,
    created_at: "2026-01-01T08:00:00",
  },
  profiles: [{ kind: "patient" }],
  memberships: [],
  health_record: {
    id: "hr-1",
    patient_id: "user-1",
    maternal_status: "none",
    entries: [],
    created_at: "2026-01-01T08:00:00",
    updated_at: "2026-01-01T08:00:00",
  },
  appointments: [],
  messages: [],
};

function renderSettings(onAccountDeleted = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return {
    onAccountDeleted,
    ...render(
      <QueryClientProvider client={client}>
        <Settings user={patient} onAccountDeleted={onAccountDeleted} />
      </QueryClientProvider>,
    ),
  };
}

describe("Settings", () => {
  const createObjectURL = vi.fn((_blob: Blob) => "blob:account-export");
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    fetchAccountExportMock.mockResolvedValue(exportedAccount);
    deleteAccountMock.mockResolvedValue(null);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing without a user", () => {
    const client = new QueryClient();
    const { container } = render(
      <QueryClientProvider client={client}>
        <Settings user={null} onAccountDeleted={vi.fn()} />
      </QueryClientProvider>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("downloads the caller's export as JSON", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("button", { name: /download my data/i }));

    expect(await screen.findByRole("status")).toHaveTextContent("Your data has been downloaded.");
    expect(fetchAccountExportMock).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);

    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(JSON.parse(await blob.text())).toEqual(exportedAccount);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:account-export");
  });

  it("surfaces an export failure", async () => {
    const user = userEvent.setup();
    fetchAccountExportMock.mockRejectedValue(new Error("Server unavailable"));
    renderSettings();

    await user.click(screen.getByRole("button", { name: /download my data/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Server unavailable");
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("asks for confirmation before deleting the account", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("button", { name: "Delete my account" }));

    expect(deleteAccountMock).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Delete your account" })).toBeInTheDocument();
  });

  it("keeps the account when the confirmation is cancelled", async () => {
    const user = userEvent.setup();
    const { onAccountDeleted } = renderSettings();

    await user.click(screen.getByRole("button", { name: "Delete my account" }));
    await user.click(screen.getByRole("button", { name: "Keep my account" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(deleteAccountMock).not.toHaveBeenCalled();
    expect(onAccountDeleted).not.toHaveBeenCalled();
  });

  it("deletes the account and signs the caller out", async () => {
    const user = userEvent.setup();
    const { onAccountDeleted } = renderSettings();

    await user.click(screen.getByRole("button", { name: "Delete my account" }));
    await user.click(screen.getByRole("button", { name: "Yes, delete my account" }));

    await waitFor(() => expect(onAccountDeleted).toHaveBeenCalledTimes(1));
    expect(deleteAccountMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the confirmation open when deletion fails", async () => {
    const user = userEvent.setup();
    deleteAccountMock.mockRejectedValue(new Error("Could not delete"));
    const { onAccountDeleted } = renderSettings();

    await user.click(screen.getByRole("button", { name: "Delete my account" }));
    await user.click(screen.getByRole("button", { name: "Yes, delete my account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not delete");
    expect(screen.getByRole("dialog", { name: "Delete your account" })).toBeInTheDocument();
    expect(onAccountDeleted).not.toHaveBeenCalled();
  });
});
