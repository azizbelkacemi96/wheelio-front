import { describe, expect, it } from "vitest";
import { handlers } from "./handlers";
import { agentFixture, managerFixture, ownerFixture } from "../fixtures/scope";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

describe("MSW handlers + Scope fixtures (Wave 0 test-data layer)", () => {
  it("registers a handler for every confirmed wheelio-api endpoint", () => {
    expect(handlers.length).toBe(6);
  });

  it("GET /me returns the owner fixture shape via the real MSW server", async () => {
    const res = await fetch(`${API_URL}/me`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.user.org_role).toBe("owner");
  });

  it("POST /auth/login returns an AuthResponse-shaped body", async () => {
    const res = await fetch(`${API_URL}/auth/login`, { method: "POST" });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.token_type).toBe("Bearer");
    expect(body.access_token).toBeTruthy();
  });

  it("GET /agencies returns the owner's multi-agency list", async () => {
    const res = await fetch(`${API_URL}/agencies`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(2);
  });

  it("owner fixture has org_role 'owner'", () => {
    expect(ownerFixture.me.user.org_role).toBe("owner");
  });

  it("agent fixture carries an 'agent' membership role", () => {
    expect(agentFixture.me.memberships[0]?.role).toBe("agent");
  });

  it("manager fixture carries a 'manager' membership role", () => {
    expect(managerFixture.me.memberships[0]?.role).toBe("manager");
  });
});
