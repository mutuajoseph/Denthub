import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AccountExportWire } from "../lib/accountApi";
import { deleteAccount, fetchAccountExport } from "../lib/accountApi";
import type { AuthUser } from "../lib/auth";
import { Settings } from "./Settings";

import { useMyVerifications, useSubmitVerification } from "../hooks/useVerification";
import type { VerificationApplicationWire } from "../lib/verificationApi";

vi.mock("../hooks/useVerification", () => ({
  useMyVerifications: vi.fn(),
  useSubmitVerification: vi.fn(),
}));

const useMyVerificationsMock = vi.mocked(useMyVerifications);
const useSubmitVerificationMock = vi.mocked(useSubmitVerification);
const submitVerificationMock = vi.fn();

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
  phone: null,
  home_country_code: null,
  role: "patient",
  is_staff: false,
  account_status: "active",
  email_verified: true,
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
  supplier: null,
  training_provider: null,
  specialist: null,
};

function renderSettings(onAccountDeleted = vi.fn(), user: AuthUser = patient) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return {
    onAccountDeleted,
    ...render(
      <QueryClientProvider client={client}>
        <Settings user={user} onAccountDeleted={onAccountDeleted} />
      </QueryClientProvider>,
    ),
  };
}

describe("Settings", () => {
  const createObjectURL = vi.fn((_blob: Blob) => "blob:account-export");
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useMyVerificationsMock.mockReturnValue({
      data: [],
      isPending: false,
      error: null,
    } as never);
    useSubmitVerificationMock.mockReturnValue({
      mutate: submitVerificationMock,
      isPending: false,
    } as never);
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

  it("submits a Verification application for a professional account", async () => {
    const user = userEvent.setup();
    const specialist: AuthUser = { ...patient, profiles: [{ kind: "specialist" }] };
    renderSettings(vi.fn(), specialist);

    await user.type(await screen.findByLabelText("Licence or registration number"), "LIC-9");
    await user.type(screen.getByLabelText("Issuing body"), "Dental Board");
    await user.type(screen.getByLabelText(/Private document keys/), "key-1.pdf, key-2.pdf");
    await user.click(screen.getByRole("button", { name: "Submit application" }));

    expect(submitVerificationMock).toHaveBeenCalledWith(
      {
        subject_kind: "specialist",
        licence_number: "LIC-9",
        issuing_body: "Dental Board",
        document_keys: ["key-1.pdf", "key-2.pdf"],
      },
      expect.anything(),
    );
  });

  it("shows a rejection reason on the latest application", async () => {
    const application: VerificationApplicationWire = {
      id: "v-1",
      subject_kind: "specialist",
      subject_id: "sp-1",
      applicant_email: "patient@example.com",
      licence_number: "LIC-9",
      issuing_body: "Dental Board",
      document_keys: ["key-1.pdf"],
      status: "rejected",
      rejection_reason: "Unreadable licence",
      created_at: "2030-01-01T10:00:00Z",
      decided_at: "2030-01-02T10:00:00Z",
    };
    useMyVerificationsMock.mockReturnValue({
      data: [application],
      isPending: false,
      error: null,
    } as never);
    const specialist: AuthUser = { ...patient, profiles: [{ kind: "specialist" }] };
    renderSettings(vi.fn(), specialist);

    expect(await screen.findByText("Unreadable licence")).toBeInTheDocument();
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
