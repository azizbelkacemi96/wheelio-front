import { describe, expect, it } from "vitest";
import { handlers } from "./handlers";
import { agentFixture, managerFixture, ownerFixture } from "../fixtures/scope";
import {
  vehicleAvailable,
  vehicleFixtures,
  vehicleRented,
} from "../fixtures/fleet";
import {
  activeContractFixture,
  closedContract,
  overlapVehicleId,
  reservedContract,
} from "../fixtures/contracts";
import {
  customerCompany,
  customerFixtures,
  driverHamdiA,
} from "../fixtures/customers";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080/v1";

describe("MSW handlers + Scope fixtures (Wave 0 test-data layer)", () => {
  it("registers a handler for every confirmed wheelio-api endpoint", () => {
    // +7 Phase-5 inspection, +8 Phase-6 billing, +10 Phase-8 fleet-mgmt &
    // documents, +7 Phase-9 admin, +1 dashboard aggregate.
    expect(handlers.length).toBe(53);
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

  it("GET /vehicles/:vehicleId/rental-contracts?status=active includes the active contract for the rented vehicle", async () => {
    const res = await fetch(
      `${API_URL}/vehicles/${vehicleRented.id}/rental-contracts?status=active`,
    );
    const body = (await res.json()) as {
      id: string;
      status: string;
      departure_fuel_level?: string;
    }[];
    expect(res.status).toBe(200);
    // Phase 4 fixtures add an active-ending-today contract on the same rented
    // vehicle (OPS-01 returns), so the list now carries more than one active.
    expect(body.every((c) => c.status === "active")).toBe(true);
    const active = body.find((c) => c.id === activeContractFixture.id);
    expect(active).toBeDefined();
    expect(active?.departure_fuel_level).toBe(
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

  // ---- Rentals lifecycle handlers (Phase 4 Wave 0 test-data layer) ----

  it("GET /vehicles/:vehicleId/rental-contracts now lists all statuses from the contracts fixtures", async () => {
    const res = await fetch(
      `${API_URL}/vehicles/${vehicleAvailable.id}/rental-contracts`,
    );
    const body = (await res.json()) as { status: string }[];
    expect(res.status).toBe(200);
    // vehicleAvailable carries reserved + cancelled + reserved-today fixtures.
    expect(body.length).toBeGreaterThanOrEqual(2);
    expect(body.some((c) => c.status === "reserved")).toBe(true);
  });

  it("POST /vehicles/:vehicleId/rental-contracts returns 201 reserved for a free window", async () => {
    const res = await fetch(
      `${API_URL}/vehicles/${vehicleRented.id}/rental-contracts`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerCompany.id,
          starts_at: "2027-01-01T09:00:00.000Z",
          ends_at: "2027-01-05T09:00:00.000Z",
        }),
      },
    );
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.status).toBe("reserved");
    expect(body.id).toBeTruthy();
  });

  it("POST create returns 409 application/problem+json when the window overlaps", async () => {
    const res = await fetch(
      `${API_URL}/vehicles/${overlapVehicleId}/rental-contracts`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerCompany.id,
          // Intersects overlapReservedA's [10-10, 10-20] window.
          starts_at: "2026-10-12T09:00:00.000Z",
          ends_at: "2026-10-14T09:00:00.000Z",
        }),
      },
    );
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
    expect(body.detail).toContain("overlaps");
  });

  it("POST create returns 400 when ends_at is not after starts_at", async () => {
    const res = await fetch(
      `${API_URL}/vehicles/${vehicleRented.id}/rental-contracts`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerCompany.id,
          starts_at: "2027-02-01T09:00:00.000Z",
          ends_at: "2027-02-01T09:00:00.000Z",
        }),
      },
    );
    expect(res.status).toBe(400);
  });

  it("POST /rental-contracts/:id/activate returns 200 active echoing mileage+fuel", async () => {
    const res = await fetch(
      `${API_URL}/rental-contracts/${reservedContract.id}/activate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mileage: 12345, fuel: "half" }),
      },
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe("active");
    expect(body.departure_mileage).toBe(12345);
    expect(body.departure_fuel_level).toBe("half");
  });

  it("POST /rental-contracts/:id/close returns 400 with zero invoice lines, 200 with ≥1", async () => {
    const bad = await fetch(
      `${API_URL}/rental-contracts/${activeContractFixture.id}/close`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mileage: 20000, fuel: "full", invoice_lines: [] }),
      },
    );
    expect(bad.status).toBe(400);

    const ok = await fetch(
      `${API_URL}/rental-contracts/${activeContractFixture.id}/close`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mileage: 20000,
          fuel: "full",
          invoice_lines: [
            {
              description: "Location 7 jours",
              quantity: 7,
              unit_price_ht_cents: 500000,
              vat_rate: 19,
            },
          ],
        }),
      },
    );
    const okBody = await ok.json();
    expect(ok.status).toBe(200);
    expect(okBody.status).toBe("closed");
    expect(okBody.return_mileage).toBe(20000);
  });

  it("POST /rental-contracts/:id/cancel returns 400 without a reason, 200 with one", async () => {
    const bad = await fetch(
      `${API_URL}/rental-contracts/${reservedContract.id}/cancel`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "" }),
      },
    );
    expect(bad.status).toBe(400);

    const ok = await fetch(
      `${API_URL}/rental-contracts/${reservedContract.id}/cancel`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Client indisponible" }),
      },
    );
    const okBody = await ok.json();
    expect(ok.status).toBe(200);
    expect(okBody.status).toBe("cancelled");
    expect(okBody.cancel_reason).toBe("Client indisponible");
  });

  it("GET /rental-contracts/:id returns 200 for a fixture, 404 for an unknown id", async () => {
    const ok = await fetch(`${API_URL}/rental-contracts/${closedContract.id}`);
    const okBody = await ok.json();
    expect(ok.status).toBe(200);
    expect(okBody.id).toBe(closedContract.id);

    const missing = await fetch(
      `${API_URL}/rental-contracts/00000000-0000-4000-8000-000000000000`,
    );
    expect(missing.status).toBe(404);
  });

  it("POST /rental-contracts/:id/deposit returns 200 echoing amount+method", async () => {
    const res = await fetch(
      `${API_URL}/rental-contracts/${reservedContract.id}/deposit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_cents: 2000000, method: "cash" }),
      },
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.deposit_amount_cents).toBe(2000000);
    expect(body.deposit_method).toBe("cash");
  });

  // ---- Customer handlers (Phase 3 Wave 0 test-data layer) ----

  it("GET /customers?q= narrows results to matching fixtures (name/legal_name/CIN/RC)", async () => {
    const res = await fetch(`${API_URL}/customers?q=Hamdi`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(customerCompany.id);
  });

  it("GET /customers with no q returns the full fixture slice", async () => {
    const res = await fetch(`${API_URL}/customers`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toHaveLength(customerFixtures.length);
  });

  it("POST /customers echoes the body and returns 201 with a generated id", async () => {
    const res = await fetch(`${API_URL}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "individual", full_name: "Test Client" }),
    });
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.full_name).toBe("Test Client");
    expect(body.id).toBeTruthy();
    expect(body.created_at).toBeTruthy();
  });

  it("GET /customers/:customerId returns 404 for an unknown id", async () => {
    const res = await fetch(
      `${API_URL}/customers/00000000-0000-4000-8000-000000000000`,
    );
    expect(res.status).toBe(404);
  });

  it("GET /customers/:customerId returns the matching fixture", async () => {
    const res = await fetch(`${API_URL}/customers/${customerCompany.id}`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.legal_name).toBe(customerCompany.legal_name);
  });

  it("POST /customers/:customerId/drivers returns 201 with the path customer_id", async () => {
    const res = await fetch(
      `${API_URL}/customers/${customerCompany.id}/drivers`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: "New Driver",
          license_number: "AL-2026-000001",
        }),
      },
    );
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.customer_id).toBe(customerCompany.id);
    expect(body.full_name).toBe("New Driver");
  });

  it("POST /customers/:customerId/drivers returns 400 for an unknown parent customer", async () => {
    const res = await fetch(
      `${API_URL}/customers/00000000-0000-4000-8000-000000000000/drivers`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: "X", license_number: "Y" }),
      },
    );
    expect(res.status).toBe(400);
  });

  it("GET /customers/:customerId/drivers returns that customer's drivers", async () => {
    const res = await fetch(`${API_URL}/customers/${customerCompany.id}/drivers`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.map((d: { id: string }) => d.id)).toContain(driverHamdiA.id);
  });
});
