import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiRequest } from "./apiClient";
import { clearStoredAuth, getStoredToken } from "./auth";

const user = {
  id: "u-1",
  email: "amina@example.com",
  full_name: "Amina Wanjiku",
  role: "patient",
  is_staff: false,
  account_status: "active",
  email_verified: true,
  profiles: [{ kind: "patient" }],
  memberships: [],
};

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  } as Response;
}

describe("apiClient session refresh (#121)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearStoredAuth();
  });

  it("refreshes once on a 401 and retries the request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(401, { code: 401, message: "Invalid or expired" }))
      .mockResolvedValueOnce(
        response(200, {
          access_token: "fresh-token",
          token_type: "bearer",
          user,
        }),
      )
      .mockResolvedValueOnce(response(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/auth/me", { auth: true })).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [refreshUrl] = fetchMock.mock.calls[1] as [string];
    expect(refreshUrl).toBe("/api/v1/auth/refresh");
    expect(getStoredToken()).toBe("fresh-token");
  });

  it("gives up without looping when the refresh is refused", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(401, { code: 401, message: "Invalid or expired" }))
      .mockResolvedValueOnce(response(401, { code: 401, message: "This session has ended" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/auth/me", { auth: true })).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not attempt a refresh for a public request", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response(401, { code: 401, message: "Nope" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/products")).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
