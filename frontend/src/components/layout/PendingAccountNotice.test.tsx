import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMyVerifications } from "../../hooks/useVerification";
import type { AuthUser } from "../../lib/auth";
import type { VerificationApplicationWire } from "../../lib/verificationApi";
import { PendingAccountNotice } from "./PendingAccountNotice";

vi.mock("../../hooks/useVerification", () => ({ useMyVerifications: vi.fn() }));
const useMyVerificationsMock = vi.mocked(useMyVerifications);

const user: AuthUser = {
  id: "user-1",
  email: "dentist@example.com",
  full_name: "Dentist User",
  phone: null,
  home_country_code: null,
  role: "dentist",
  is_staff: false,
  account_status: "active",
  email_verified: true,
  profiles: [],
  memberships: [],
};

function application(status: VerificationApplicationWire["status"]): VerificationApplicationWire {
  return {
    id: "v-1",
    subject_kind: "specialist",
    subject_id: "sp-1",
    applicant_email: user.email,
    licence_number: "LIC-1",
    issuing_body: "Dental Board",
    document_keys: ["private/doc.pdf"],
    status,
    rejection_reason: null,
    created_at: "2030-01-01T10:00:00Z",
    decided_at: status === "pending" ? null : "2030-01-02T10:00:00Z",
  };
}

describe("PendingAccountNotice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMyVerificationsMock.mockReturnValue({ data: [], isPending: false } as never);
  });

  it("shows the notice while the latest Verification application is pending", () => {
    useMyVerificationsMock.mockReturnValue({ data: [application("pending")] } as never);
    render(<PendingAccountNotice user={user} />);

    expect(
      screen.getByRole("complementary", { name: "Account awaiting approval" }),
    ).toHaveTextContent(/awaiting Verification/i);
  });

  it("renders nothing for an active account with no pending application", () => {
    render(<PendingAccountNotice user={user} />);

    expect(
      screen.queryByRole("complementary", { name: "Account awaiting approval" }),
    ).not.toBeInTheDocument();
  });

  it("renders nothing for a decided application", () => {
    useMyVerificationsMock.mockReturnValue({ data: [application("verified")] } as never);
    render(<PendingAccountNotice user={user} />);

    expect(
      screen.queryByRole("complementary", { name: "Account awaiting approval" }),
    ).not.toBeInTheDocument();
  });

  it("renders nothing when there is no signed-in user", () => {
    render(<PendingAccountNotice user={null} />);

    expect(
      screen.queryByRole("complementary", { name: "Account awaiting approval" }),
    ).not.toBeInTheDocument();
  });
});
