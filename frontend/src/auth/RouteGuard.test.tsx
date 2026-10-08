import { render, screen } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { AuthUser } from "../lib/auth";
import RouteGuard, { type GuardScope } from "./RouteGuard";
import { ROLE, type Role } from "./roles";

function makeUser(role: Role): AuthUser {
  return {
    id: "user-1",
    email: "user@example.com",
    full_name: "Test User",
    role,
    is_staff: false,
  };
}

function LocationView() {
  const location = useLocation();
  const state = location.state as { returnTo?: string } | null;

  return (
    <div>
      <p data-testid="location-path">{location.pathname}</p>
      <p data-testid="location-search">{location.search}</p>
      <p data-testid="return-to">{state?.returnTo ?? ""}</p>
    </div>
  );
}

function renderGuard({
  user = null,
  scope = "public",
  initialEntry = "/private",
}: {
  user?: AuthUser | null;
  scope?: GuardScope;
  initialEntry?: string;
}) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/private"
          element={
            <RouteGuard scope={scope} user={user}>
              <p>Private content</p>
            </RouteGuard>
          }
        />
        <Route path="/sign-in" element={<LocationView />} />
        <Route path="/staff/access" element={<LocationView />} />
        <Route path="/dashboard" element={<LocationView />} />
        <Route path="/dashboard/facility" element={<LocationView />} />
        <Route path="/dashboard/supplier" element={<LocationView />} />
        <Route path="/dashboard/training" element={<LocationView />} />
        <Route path="/admin" element={<LocationView />} />
        <Route path="/operations" element={<LocationView />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RouteGuard", () => {
  it("sends an unauthenticated public user to sign-in and preserves the attempted URL", () => {
    renderGuard({ initialEntry: "/private?tab=records#history" });

    expect(screen.getByTestId("location-path")).toHaveTextContent("/sign-in");
    expect(screen.getByTestId("location-search")).toHaveTextContent("");
    expect(screen.getByTestId("return-to")).toHaveTextContent("/private?tab=records#history");
    expect(screen.queryByText("Private content")).not.toBeInTheDocument();
  });

  it("renders content for an allowed facility role", () => {
    renderGuard({ user: makeUser(ROLE.FACILITY_OWNER), scope: "facility" });

    expect(screen.getByText("Private content")).toBeInTheDocument();
  });

  it("sends a user with the wrong portal role to their canonical dashboard", () => {
    renderGuard({
      user: makeUser(ROLE.SUPPLIER),
      scope: "facility",
      initialEntry: "/private?from=facility",
    });

    expect(screen.getByTestId("location-path")).toHaveTextContent("/dashboard/supplier");
    expect(screen.getByTestId("return-to")).toHaveTextContent("/private?from=facility");
    expect(screen.queryByText("Private content")).not.toBeInTheDocument();
  });

  it("uses the separate staff entry point for unauthenticated admin routes", () => {
    renderGuard({ scope: "admin" });

    expect(screen.getByTestId("location-path")).toHaveTextContent("/staff/access");
    expect(screen.queryByText("Private content")).not.toBeInTheDocument();
  });

  it("keeps operations access scoped to platform operators", () => {
    renderGuard({ user: makeUser(ROLE.ADMIN), scope: "operations" });

    expect(screen.getByTestId("location-path")).toHaveTextContent("/admin");
    expect(screen.queryByText("Private content")).not.toBeInTheDocument();
  });
});
