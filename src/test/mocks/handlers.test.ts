import { describe, expect, it } from "vitest";
import { handlers } from "./handlers";
import { agentFixture, managerFixture, ownerFixture } from "../fixtures/scope";
import {
  activeContractFixture,
  vehicleAvailable,
  vehicleFixtures,
  vehicleRented,
} from "../fixtures/fleet";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080/v1";

describe("MSW handlers + Scope fixtures (Wave 0 test-data layer)", () => {
  it("registers a handler for every confirmed wheelio-api endpoint", () => {
    expect(handlers.length).toBe(9);
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

  // ---- Fleet handlers (Phase 2 Wave 0 test-data layer) ----

  it("GET /vehicles returns the full vehicle fixture array", async () => {
    const res = await fetch(`${API_URL}/vehicles`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toHaveLength(vehicleFixtures.length);
    expect(body.map((v: { id: string }) => v.id)).toEqual(
      vehicleFixtures.map((v) => v.id),
    );
  });

  it("GET /vehicles?status=rented returns only rented vehicles", async () => {
    const res = await fetch(`${API_URL}/vehicles?status=rented`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(vehicleRented.id);
    expect(body[0].status).toBe("rented");
  });

  it("GET /vehicles?agency_id={id} returns only that agency's vehicles", async () => {
    const agencyAlgerId = ownerFixture.agencies[0].id;
    const res = await fetch(`${API_URL}/vehicles?agency_id=${agencyAlgerId}`);
    const body = (await res.json()) as { agency_id: string }[];
    expect(res.status).toBe(200);
    expect(body.length).toBeGreaterThan(0);
    expect(body.every((v) => v.agency_id === agencyAlgerId)).toBe(true);
    expect(body.length).toBe(
      vehicleFixtures.filter((v) => v.agency_id === agencyAlgerId).length,
    );
  });

  it("GET /vehicles with an invalid ?status value returns 400", async () => {
    const res = await fetch(`${API_URL}/vehicles?status=bogus`);
    expect(res.status).toBe(400);
  });

  it("GET /vehicles/:vehicleId returns the matching fixture", async () => {
    const res = await fetch(`${API_URL}/vehicles/${vehicleAvailable.id}`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.id).toBe(vehicleAvailable.id);
    expect(body.registration_plate).toBe(vehicleAvailable.registration_plate);
  });

  it("GET /vehicles/:vehicleId returns 404 for an unknown id", async () => {
    const res = await fetch(
      `${API_URL}/vehicles/00000000-0000-4000-8000-000000000000`,
    );
    expect(res.status).toBe(404);
  });

  it("GET /vehicles/:vehicleId/rental-contracts?status=active returns the active contract for the rented vehicle", async () => {
    const res = await fetch(
      `${API_URL}/vehicles/${vehicleRented.id}/rental-contracts?status=active`,
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(activeContractFixture.id);
    expect(body[0].departure_fuel_level).toBe(
      activeContractFixture.departure_fuel_level,
    );
  });

  it("GET /vehicles/:vehicleId/rental-contracts?status=active returns [] for every other vehicle", async () => {
    const res = await fetch(
      `${API_URL}/vehicles/${vehicleAvailable.id}/rental-contracts?status=active`,
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });
});
