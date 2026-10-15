import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AuthUser } from "../lib/auth";
import { Dashboard } from "./Dashboard";

const user: AuthUser = {
  id: "user-1",
  email: "patient@example.com",
  full_name: "Amina Yusuf",
  role: "patient",
  is_staff: false,
  account_status: "active",
};

describe("Dashboard", () => {
  it("shows the signed-in user's identity", () => {
    render(<Dashboard user={user} />);

    expect(screen.getByRole("heading", { name: /your account/i })).toBeInTheDocument();
    expect(screen.getByText("Amina Yusuf")).toBeInTheDocument();
    expect(screen.getByText("patient@example.com")).toBeInTheDocument();
    expect(screen.getByText("Patient")).toBeInTheDocument();
  });

  it("renders nothing without a user", () => {
    const { container } = render(<Dashboard user={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
