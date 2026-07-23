import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { server } from "@/test/mocks/server";
import { ownerFixture } from "@/test/fixtures/scope";
import { useAuthStore } from "./store";
import { ensureSession, resetSession } from "./session";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

function resetAuthStore() {
  useAuthStore.setState({
    accessToken: null,
    accessTokenExpiresAt: null,
    refreshToken: null,
    scope: null,
    user: null,
    agencies: [],
    currentAgencyId: null,
  });
  localStorage.clear();
  resetSession();
}

describe("ensureSession", () => {
  beforeEach(resetAuthStore);
  afterEach(resetAuthStore);

  it("with no access token in memory: refreshes via the stored refresh token, then fetches /me exactly once and memoises the Scope", async () => {
    let meCalls = 0;
    server.use(
      http.get(`${API_URL}/me`, () => {
        meCalls += 1;
        return HttpResponse.json(ownerFixture.me);
      }),
    );
    useAuthStore.setState({ refreshToken: "valid-refresh-token" });

    const scope = await ensureSession();

    expect(scope).not.toBeNull();
    expect(scope?.orgRole).toBe("owner");
    expect(meCalls).toBe(1);
    expect(useAuthStore.getState().scope).toEqual(scope);

    // Repeat calls within the same session never refetch /me.
    await ensureSession();
    await ensureSession();
    expect(meCalls).toBe(1);
  });

  it("concurrent callers during the bootstrap window share the same in-flight promise — /me fetched exactly once", async () => {
    let meCalls = 0;
    server.use(
      http.get(`${API_URL}/me`, async () => {
        meCalls += 1;
        return HttpResponse.json(ownerFixture.me);
      }),
    );
    useAuthStore.setState({ refreshToken: "valid-refresh-token" });

    const [a, b, c] = await Promise.all([
      ensureSession(),
      ensureSession(),
      ensureSession(),
    ]);

    expect(meCalls).toBe(1);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it("skips the /auth/refresh call entirely when an access token is already in memory (fresh login)", async () => {
    let refreshCalls = 0;
    server.use(
      http.post(`${API_URL}/auth/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json({});
      }),
      http.get(`${API_URL}/me`, () => HttpResponse.json(ownerFixture.me)),
    );
    useAuthStore.setState({ accessToken: "already-have-one" });

    const scope = await ensureSession();

    expect(scope).not.toBeNull();
    expect(refreshCalls).toBe(0);
  });

  it("resolves to null (never throws) when refresh itself fails — the ONE case the route guard redirects on", async () => {
    server.use(
      http.post(`${API_URL}/auth/refresh`, () => new HttpResponse(null, { status: 401 })),
    );
    useAuthStore.setState({ refreshToken: "stale-refresh-token" });

    const scope = await ensureSession();

    expect(scope).toBeNull();
    expect(useAuthStore.getState().scope).toBeNull();
  });

  it("resolves to null when there is no refresh token at all (never logged in)", async () => {
    const scope = await ensureSession();
    expect(scope).toBeNull();
  });

  it("REJECTS (does not resolve to null) when the access token is valid but /me itself fails", async () => {
    server.use(http.get(`${API_URL}/me`, () => new HttpResponse(null, { status: 500 })));
    useAuthStore.setState({ accessToken: "already-have-one" });

    await expect(ensureSession()).rejects.toBeTruthy();
    expect(useAuthStore.getState().scope).toBeNull();
  });

  it("resetSession() lets a subsequent call re-attempt after a /me failure", async () => {
    server.use(http.get(`${API_URL}/me`, () => new HttpResponse(null, { status: 500 })));
    useAuthStore.setState({ accessToken: "already-have-one" });

    await expect(ensureSession()).rejects.toBeTruthy();
    expect(useAuthStore.getState().scope).toBeNull();

    // Swap in a healthy handler and retry, as AppShell's Retry button would.
    server.use(http.get(`${API_URL}/me`, () => HttpResponse.json(ownerFixture.me)));
    resetSession();
    const scope = await ensureSession();

    expect(scope?.orgRole).toBe("owner");
  }, 10000);

  it("does NOT replay a resolved-null outcome after a subsequent login (CR-01 login-loop regression)", async () => {
    // Logged out, no tokens at all: guard evaluation resolves null.
    expect(await ensureSession()).toBeNull();

    // User then logs in on /login: tokens land in the store, but scope stays
    // null until a bootstrap runs /me. The next guard evaluation MUST
    // re-attempt the bootstrap, not replay the cached "logged out".
    server.use(http.get(`${API_URL}/me`, () => HttpResponse.json(ownerFixture.me)));
    useAuthStore.setState({ accessToken: "fresh-login-access-token" });

    const scope = await ensureSession();
    expect(scope?.orgRole).toBe("owner");
  });

  it("does NOT resurrect the pre-logout Scope after clearSession (CR-02 guard-bypass regression)", async () => {
    server.use(http.get(`${API_URL}/me`, () => HttpResponse.json(ownerFixture.me)));
    useAuthStore.setState({ refreshToken: "valid-refresh-token" });
    expect((await ensureSession())?.orgRole).toBe("owner");

    // Logout: store cleared. Back-button into a guarded route must resolve
    // null (redirect to /login), never the stale pre-logout Scope.
    useAuthStore.getState().clearSession();
    resetSession();

    expect(await ensureSession()).toBeNull();
  });

  it("REJECTS on a transient refresh failure (network/5xx) and PRESERVES the refresh token — no false 'Session expirée'", async () => {
    server.use(
      http.post(`${API_URL}/auth/refresh`, () => new HttpResponse(null, { status: 503 })),
    );
    useAuthStore.setState({ refreshToken: "still-good-token" });

    await expect(ensureSession()).rejects.toBeTruthy();
    // The persisted token may still be perfectly valid — a connectivity blip
    // must not force-log the user out.
    expect(useAuthStore.getState().refreshToken).toBe("still-good-token");
  });
});
