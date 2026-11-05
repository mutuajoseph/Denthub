import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AUTH_STORAGE_KEY,
  type AuthResponse,
  clearStoredAuth,
  getStoredAuth,
  getStoredSurface,
  getStoredToken,
  getStoredUser,
  refreshSession,
  setSession,
  subscribeToAuthChanges,
} from "./auth";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    text: async () => JSON.stringify(body),
  } as Response;
}

const baseUser = {
  id: "u-1",
  email: "amina@example.com",
  full_name: "Amina Wanjiku",
  phone: null,
  home_country_code: null,
  role: "facility_dentist",
  is_staff: false,
  account_status: "active",
  email_verified: true,
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

  it("reads the account phone and home Country", () => {
    store({
      ...baseUser,
      phone: "+254700000000",
      home_country_code: "KE",
    });

    const user = getStoredAuth()?.user;

    expect(user?.phone).toBe("+254700000000");
    expect(user?.home_country_code).toBe("KE");
  });

  it("treats a session stored before #119 as having no phone or home Country", () => {
    store(baseUser);

    const user = getStoredAuth()?.user;

    expect(user?.phone).toBeNull();
    expect(user?.home_country_code).toBeNull();
  });
});

describe("session storage (#121)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(window.navigator, "locks");
    window.localStorage.clear();
    clearStoredAuth();
  });

  const session: AuthResponse = {
    access_token: "memory-only-token",
    token_type: "bearer",
    user: {
      id: "u-1",
      email: "amina@example.com",
      full_name: "Amina Wanjiku",
      phone: null,
      home_country_code: null,
      role: "patient",
      is_staff: false,
      account_status: "active",
      email_verified: true,
      profiles: [{ kind: "patient" }],
      memberships: [],
    },
  };

  it("keeps the access token in memory, out of localStorage", () => {
    setSession(session);

    expect(getStoredToken()).toBe("memory-only-token");
    expect(getStoredUser()).toEqual(session.user);

    const stored = window.localStorage.getItem(AUTH_STORAGE_KEY) ?? "";
    expect(stored).not.toContain("memory-only-token");
    expect(JSON.parse(stored)).toEqual({ user: session.user, surface: "public" });
  });

  it("restores the profile after a reload without the token", () => {
    window.localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ user: session.user, surface: "public" }),
    );

    expect(getStoredToken()).toBeNull();
    expect(getStoredUser()).toEqual(session.user);
    expect(getStoredSurface()).toBe("public");
  });

  it("treats a record written before surfaces existed as public", () => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user: session.user }));

    expect(getStoredSurface()).toBe("public");
  });

  it("refreshes a staff session through the staff route", async () => {
    const staffSession: AuthResponse = {
      ...session,
      access_token: "staff-token",
      user: { ...session.user, role: "admin", is_staff: true },
    };
    window.localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ user: staffSession.user, surface: "staff" }),
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { ...staffSession, access_token: "rotated-token" }));
    vi.stubGlobal("fetch", fetchMock);

    const restored = await refreshSession();

    expect(restored?.access_token).toBe("rotated-token");
    expect(getStoredToken()).toBe("rotated-token");
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("/api/v1/auth/staff/refresh");
    expect(getStoredSurface()).toBe("staff");
  });

  it("shares one rotation between concurrent callers", async () => {
    setSession(session);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { ...session, access_token: "rotated-token" }));
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([refreshSession(), refreshSession(), refreshSession()]);

    // Single-use tokens: two rotations would read as theft and end the session.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("notifies subscribers when the session changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToAuthChanges(listener);

    setSession(session);
    expect(listener).toHaveBeenLastCalledWith(session.user);

    clearStoredAuth();
    expect(listener).toHaveBeenLastCalledWith(null);

    unsubscribe();
  });

  it("serialises rotation through the cross-tab lock", async () => {
    setSession(session);
    const request = vi.fn((_name: string, task: () => Promise<unknown>) => task());
    Object.defineProperty(window.navigator, "locks", {
      configurable: true,
      value: { request },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { ...session, access_token: "rotated-token" }));
    vi.stubGlobal("fetch", fetchMock);

    await refreshSession();

    expect(request).toHaveBeenCalledWith("denthub:refresh", expect.any(Function));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("updates subscribers when another tab clears the session", () => {
    setSession(session);
    const listener = vi.fn();
    const unsubscribe = subscribeToAuthChanges(listener);

    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    window.dispatchEvent(new StorageEvent("storage", { key: AUTH_STORAGE_KEY }));

    expect(listener).toHaveBeenLastCalledWith(null);

    unsubscribe();
  });
});
