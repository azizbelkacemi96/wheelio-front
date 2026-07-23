import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "./store";

function resetStore() {
  useAuthStore.setState({
    accessToken: null,
    accessTokenExpiresAt: null,
    refreshToken: null,
    scope: null,
    agencies: [],
    currentAgencyId: null,
  });
  localStorage.clear();
}

describe("useAuthStore token persistence", () => {
  beforeEach(resetStore);
  afterEach(resetStore);

  it("keeps accessToken in memory but persists ONLY refreshToken under localStorage key wheelio-auth", () => {
    useAuthStore.getState().setTokens({
      accessToken: "access-123",
      refreshToken: "refresh-456",
      expiresAt: "2026-01-01T00:00:00.000Z",
    });
    useAuthStore.getState().setScope({
      userId: "u1",
      orgId: "o1",
      orgRole: "member",
      agencyRoles: {},
    });

    // In-memory state carries everything.
    expect(useAuthStore.getState().accessToken).toBe("access-123");
    expect(useAuthStore.getState().refreshToken).toBe("refresh-456");
    expect(useAuthStore.getState().scope).not.toBeNull();

    // The persisted payload contains refreshToken and NOTHING else.
    const raw = localStorage.getItem("wheelio-auth");
    expect(raw).not.toBeNull();
    const persisted = JSON.parse(raw as string) as { state: Record<string, unknown> };

    expect(persisted.state).toEqual({ refreshToken: "refresh-456" });
    expect(persisted.state.accessToken).toBeUndefined();
    expect(persisted.state.scope).toBeUndefined();
    expect(persisted.state.agencies).toBeUndefined();
    expect(persisted.state.currentAgencyId).toBeUndefined();
  });

  it("clearSession nulls accessToken, refreshToken, and scope", () => {
    useAuthStore.getState().setTokens({
      accessToken: "access-123",
      refreshToken: "refresh-456",
      expiresAt: "2026-01-01T00:00:00.000Z",
    });
    useAuthStore.getState().setScope({
      userId: "u1",
      orgId: "o1",
      orgRole: "member",
      agencyRoles: {},
    });

    useAuthStore.getState().clearSession();

    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.scope).toBeNull();
  });
});

describe("useAuthStore.setCurrentAgency", () => {
  beforeEach(resetStore);
  afterEach(resetStore);

  it("is a pure client state write — updates currentAgencyId with zero network calls", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    useAuthStore.getState().setCurrentAgency("agency-alger");

    expect(useAuthStore.getState().currentAgencyId).toBe("agency-alger");
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});
