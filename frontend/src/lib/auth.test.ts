import { afterEach, describe, expect, it } from "vitest";

import { AUTH_STORAGE_KEY, getStoredAuth } from "./auth";

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
