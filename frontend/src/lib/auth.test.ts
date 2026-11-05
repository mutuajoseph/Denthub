import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { postJson } from "./apiClient";
import { AUTH_STORAGE_KEY, changePassword, getStoredAuth, resendVerificationEmail } from "./auth";

vi.mock("./apiClient", () => ({ postJson: vi.fn() }));

const baseUser = {
  id: "u-1",
  email: "amina@example.com",
  full_name: "Amina Wanjiku",
  role: "facility_dentist",
  is_staff: false,
  account_status: "active",
};

function store(user: Record<string, unknown>) {
  window.localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({ access_token: "t", token_type: "bearer", user }),
  );
}

describe("stored auth: Profiles and Facility Memberships (#117)", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("reads profiles and memberships as the API returns them", () => {
    store({
      ...baseUser,
      profiles: [{ kind: "specialist" }],
      memberships: [
        { facility_id: "f-1", facility_name: "Smile Dental", permissions: ["owner", "clinical"] },
      ],
    });

    const user = getStoredAuth()?.user;

    expect(user?.profiles).toEqual([{ kind: "specialist" }]);
    expect(user?.memberships).toEqual([
      { facility_id: "f-1", facility_name: "Smile Dental", permissions: ["owner", "clinical"] },
    ]);
  });

  it("treats a session stored before #117 as holding none", () => {
    store(baseUser);

    const user = getStoredAuth()?.user;

    expect(user?.role).toBe("facility_dentist");
    expect(user?.profiles).toEqual([]);
    expect(user?.memberships).toEqual([]);
  });

  it("drops unknown profile kinds and permissions", () => {
    store({
      ...baseUser,
      profiles: [{ kind: "wizard" }, { kind: "patient" }],
      memberships: [
        { facility_id: "f-1", facility_name: "Smile", permissions: ["root", "clinical"] },
      ],
    });

    const user = getStoredAuth()?.user;

    expect(user?.profiles).toEqual([{ kind: "patient" }]);
    expect(user?.memberships[0]?.permissions).toEqual(["clinical"]);
  });

  it("drops a membership left with no known permission", () => {
    store({
      ...baseUser,
      memberships: [{ facility_id: "f-1", facility_name: "Smile", permissions: ["root"] }],
    });

    expect(getStoredAuth()?.user.memberships).toEqual([]);
  });
});

describe("signed-in account calls (#141)", () => {
  const postJsonMock = vi.mocked(postJson);

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("changes the password with the session and stores the returned one", async () => {
    postJsonMock.mockResolvedValue({
      access_token: "fresh-token",
      token_type: "bearer",
      user: { ...baseUser, email_verified: true },
    });

    await changePassword("old-pass", "new-passphrase");

    expect(postJsonMock).toHaveBeenCalledWith(
      "/auth/password/change",
      { current_password: "old-pass", new_password: "new-passphrase" },
      { auth: true },
    );
    expect(getStoredAuth()?.access_token).toBe("fresh-token");
    expect(getStoredAuth()?.user.email).toBe(baseUser.email);
  });

  it("asks for a new verification link with the session", async () => {
    postJsonMock.mockResolvedValue(null);

    await resendVerificationEmail();

    expect(postJsonMock).toHaveBeenCalledWith("/auth/verify-email/resend", undefined, {
      auth: true,
    });
  });
});
