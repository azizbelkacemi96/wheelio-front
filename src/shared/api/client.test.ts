import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "@/shared/auth/store";
import { server } from "@/test/mocks/server";
import { api, refreshAccessToken } from "./client";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080/v1";

const FAKE_USER = {
  id: "44444444-4444-4444-8444-444444444444",
  email: "agent.alger@wheelio.dz",
  first_name: "Yacine",
  last_name: "Benali",
  org_role: "member" as const,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
};
const FAKE_ORG = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Wheelio Location Alger",
  created_at: "2026-01-01T00:00:00.000Z",
};

function resetAuthStore() {
  useAuthStore.setState({
    accessToken: "stale-access-token",
    accessTokenExpiresAt: null,
    refreshToken: "valid-refresh-token",
    scope: null,
    agencies: [],
    currentAgencyId: null,
  });
  localStorage.clear();
}

describe("api client — single-flight refresh interceptor", () => {
  beforeEach(resetAuthStore);
  afterEach(resetAuthStore);

  it("two concurrent 401s trigger exactly ONE POST /auth/refresh; both requests then succeed with the rotated token", async () => {
    let refreshCalls = 0;
    let protectedCalls = 0;

    server.use(
      http.post(`${API_URL}/auth/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json({
          token_type: "Bearer",
          access_token: "fresh-access-token",
          access_token_expires_at: "2026-01-01T01:00:00.000Z",
          refresh_token: "rotated-refresh-token",
          user: FAKE_USER,
          organization: FAKE_ORG,
        });
      }),
      http.get(`${API_URL}/protected`, ({ request }) => {
        protectedCalls += 1;
        const auth = request.headers.get("Authorization");
        if (auth === "Bearer fresh-access-token") {
          return HttpResponse.json({ ok: true });
        }
        return new HttpResponse(null, { status: 401 });
      }),
    );

    const [r1, r2] = await Promise.all([
      api.get("protected").json(),
      api.get("protected").json(),
    ]);

    expect(r1).toEqual({ ok: true });
    expect(r2).toEqual({ ok: true });
    expect(refreshCalls).toBe(1);
    // 2 initial 401s (stale token) + 2 successful retries (fresh token).
    expect(protectedCalls).toBe(4);
    expect(useAuthStore.getState().accessToken).toBe("fresh-access-token");
    expect(useAuthStore.getState().refreshToken).toBe("rotated-refresh-token");
  });

  it("refresh success retries the original request once and returns its result — no redirect, no clearSession", async () => {
    server.use(
      http.post(`${API_URL}/auth/refresh`, () =>
        HttpResponse.json({
          token_type: "Bearer",
          access_token: "fresh-access-token",
          access_token_expires_at: "2026-01-01T01:00:00.000Z",
          refresh_token: "rotated-refresh-token",
          user: FAKE_USER,
          organization: FAKE_ORG,
        }),
      ),
      http.get(`${API_URL}/protected`, ({ request }) => {
        const auth = request.headers.get("Authorization");
        return auth === "Bearer fresh-access-token"
          ? HttpResponse.json({ ok: true })
          : new HttpResponse(null, { status: 401 });
      }),
    );

    const result = await api.get("protected").json();

    expect(result).toEqual({ ok: true });
    expect(useAuthStore.getState().refreshToken).toBe("rotated-refresh-token");
  });

  it("refresh failure clears the session and rejects — no retry loop", async () => {
    let refreshCalls = 0;

    server.use(
      http.post(`${API_URL}/auth/refresh`, () => {
        refreshCalls += 1;
        return new HttpResponse(null, { status: 401 });
      }),
      http.get(`${API_URL}/protected`, () => new HttpResponse(null, { status: 401 })),
    );

    await expect(api.get("protected").json()).rejects.toThrow();

    expect(refreshCalls).toBe(1);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
  });

  it("refreshAccessToken itself is single-flight: concurrent DIRECT callers share one POST /auth/refresh (WR-01)", async () => {
    let refreshCalls = 0;

    server.use(
      http.post(`${API_URL}/auth/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json({
          token_type: "Bearer",
          access_token: "fresh-access-token",
          access_token_expires_at: "2026-01-01T01:00:00.000Z",
          refresh_token: "rotated-refresh-token",
          user: FAKE_USER,
          organization: FAKE_ORG,
        });
      }),
    );

    // Session bootstrap and the 401 interceptor can both need a refresh at
    // the same moment — with rotating tokens, two parallel POSTs would trip
    // the API's theft detection and revoke the whole session.
    const [a, b] = await Promise.all([refreshAccessToken(), refreshAccessToken()]);

    expect(refreshCalls).toBe(1);
    expect(a).toBe("fresh-access-token");
    expect(b).toBe("fresh-access-token");
  });

  it("a transient refresh failure (network/5xx) rejects WITHOUT clearing the session (WR-02)", async () => {
    server.use(
      http.post(`${API_URL}/auth/refresh`, () => new HttpResponse(null, { status: 503 })),
    );

    await expect(refreshAccessToken()).rejects.toThrow();

    // Only an explicit 401/403 rejection of the token clears the session.
    expect(useAuthStore.getState().refreshToken).toBe("valid-refresh-token");
  });
});
