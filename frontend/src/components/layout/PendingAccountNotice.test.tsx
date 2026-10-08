import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AuthUser } from "../../lib/auth";
import { PendingAccountNotice } from "./PendingAccountNotice";

function makeUser(accountStatus: AuthUser["account_status"]): AuthUser {
  return {
    id: "user-1",
    email: "dentist@example.com",
    full_name: "Dentist User",
    role: "dentist",
    is_staff: false,
    account_status: accountStatus,
  };
}

describe("PendingAccountNotice", () => {
  it("explains the pending state to a professional awaiting approval", () => {
    render(<PendingAccountNotice user={makeUser("pending")} />);

    expect(
      screen.getByRole("complementary", { name: "Account awaiting approval" }),
    ).toHaveTextContent(/awaiting staff approval/i);
  });

  it("renders nothing for an active account", () => {
    render(<PendingAccountNotice user={makeUser("active")} />);

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
