import { http, HttpResponse } from "msw";
import type {
  AgencyResponse,
  AuthResponse,
  MeResponse,
} from "@/types/identity";
import type { VehicleResponse, VehicleStatus } from "@/types/fleet";
import type { ContractResponse, ContractStatus } from "@/types/rental";
import type {
  CreateCustomerBody,
  CreateDriverBody,
  CustomerResponse,
  DriverResponse,
} from "@/types/customer";
import { ownerFixture } from "../fixtures/scope";
import { contractFixtures, vehicleFixtures } from "../fixtures/fleet";
import { customerFixtures, driversByCustomerId } from "../fixtures/customers";

/**
 * MSW handlers mirroring wheelio-api's confirmed endpoint shapes (see
 * 01-RESEARCH.md "Phase Requirements" + `dto.go`). Response bodies are typed
 * against src/types/identity.ts so any contract drift fails compilation, not
 * just a runtime assertion.
 *
 * Base URL is read from VITE_API_URL (same env var the real ky client uses),
 * so tests exercise the same request targets the app would hit in dev/prod.
 */

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080/v1";

function authResponseFor(me: MeResponse): AuthResponse {
  return {
    token_type: "Bearer",
    access_token: "mock-access-token",
    access_token_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    refresh_token: "mock-refresh-token",
    user: me.user,
    organization: me.organization,
  };
}

const defaultAgencies: AgencyResponse[] = ownerFixture.agencies;

// Closed enum sets mirroring the backend's oneof validations
// (fleet_dto.go `oneof=available rented maintenance retired`,
// rental_handler.go contract-status parsing) — an out-of-set ?status is 400.
const VEHICLE_STATUSES: readonly VehicleStatus[] = [
  "available",
  "rented",
  "maintenance",
  "retired",
];
const CONTRACT_STATUSES: readonly ContractStatus[] = [
  "reserved",
  "active",
  "closed",
  "cancelled",
];

export const handlers = [
  http.post(`${API_URL}/auth/login`, () => {
    return HttpResponse.json<AuthResponse>(authResponseFor(ownerFixture.me), {
      status: 200,
    });
  }),

  http.post(`${API_URL}/auth/signup`, () => {
    return HttpResponse.json<AuthResponse>(authResponseFor(ownerFixture.me), {
      status: 201,
    });
  }),

  http.post(`${API_URL}/auth/refresh`, () => {
    // Rotated tokens — same authResponse shape as login/signup per auth_handler.go.
    return HttpResponse.json<AuthResponse>(
      {
        ...authResponseFor(ownerFixture.me),
        access_token: "mock-access-token-rotated",
        refresh_token: "mock-refresh-token-rotated",
      },
      { status: 200 },
    );
  }),

  http.post(`${API_URL}/auth/logout`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API_URL}/me`, () => {
    return HttpResponse.json<MeResponse>(ownerFixture.me, { status: 200 });
  }),

  http.get(`${API_URL}/agencies`, () => {
    return HttpResponse.json<AgencyResponse[]>(defaultAgencies, { status: 200 });
  }),

  // ---- Fleet (Phase 2) ----
  // MSW v2 matches paths only, never query strings (02-RESEARCH.md Pitfall
  // 7) — each handler parses request.url's searchParams itself.

  http.get(`${API_URL}/vehicles`, ({ request }) => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const agencyId = searchParams.get("agency_id");

    if (status !== null && !VEHICLE_STATUSES.includes(status as VehicleStatus)) {
      // Mirrors vehicle_handler.go's 400 on an out-of-enum status value.
      return HttpResponse.json({ message: "invalid status" }, { status: 400 });
    }

    let vehicles = vehicleFixtures;
    if (agencyId !== null) {
      vehicles = vehicles.filter((v) => v.agency_id === agencyId);
    }
    if (status !== null) {
      vehicles = vehicles.filter((v) => v.status === status);
    }
    return HttpResponse.json<VehicleResponse[]>(vehicles, { status: 200 });
  }),

  http.get(`${API_URL}/vehicles/:vehicleId`, ({ params }) => {
    const vehicle = vehicleFixtures.find((v) => v.id === params.vehicleId);
    if (!vehicle) {
      // Backend returns 404 for both nonexistent AND out-of-scope vehicles.
      return HttpResponse.json({ message: "vehicle not found" }, { status: 404 });
    }
    return HttpResponse.json<VehicleResponse>(vehicle, { status: 200 });
  }),

  http.get(
    `${API_URL}/vehicles/:vehicleId/rental-contracts`,
    ({ request, params }) => {
      const { searchParams } = new URL(request.url);
      const status = searchParams.get("status");

      if (
        status !== null &&
        !CONTRACT_STATUSES.includes(status as ContractStatus)
      ) {
        return HttpResponse.json({ message: "invalid status" }, { status: 400 });
      }

      let contracts = contractFixtures.filter(
        (c) => c.vehicle_id === params.vehicleId,
      );
      if (status !== null) {
        contracts = contracts.filter((c) => c.status === status);
      }
      return HttpResponse.json<ContractResponse[]>(contracts, { status: 200 });
    },
  ),

  // ---- Customers (Phase 3) ----
  // Org-scoped, no agency_id anywhere (D-07/D-08) — MSW v2 matches paths
  // only, each handler parses request.url's searchParams itself.

  http.get(`${API_URL}/customers`, ({ request }) => {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";

    if (q === "") {
      return HttpResponse.json<CustomerResponse[]>(customerFixtures, {
        status: 200,
      });
    }

    const needle = q.toLowerCase();
    const matches = customerFixtures.filter((c) => {
      const haystack = [
        c.full_name,
        c.legal_name,
        c.identity_doc_number,
        c.rc,
      ]
        .filter((v): v is string => v !== undefined)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
    return HttpResponse.json<CustomerResponse[]>(matches, { status: 200 });
  }),

  http.post(`${API_URL}/customers`, async ({ request }) => {
    const body = (await request.json()) as CreateCustomerBody;
    const now = new Date().toISOString();
    const created: CustomerResponse = {
      ...body,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
    };
    return HttpResponse.json<CustomerResponse>(created, { status: 201 });
  }),

  http.get(`${API_URL}/customers/:customerId`, ({ params }) => {
    const customer = customerFixtures.find((c) => c.id === params.customerId);
    if (!customer) {
      return HttpResponse.json({ message: "customer not found" }, { status: 404 });
    }
    return HttpResponse.json<CustomerResponse>(customer, { status: 200 });
  }),

  http.post(
    `${API_URL}/customers/:customerId/drivers`,
    async ({ request, params }) => {
      const customerId = params.customerId as string;
      const parent = customerFixtures.find((c) => c.id === customerId);
      if (!parent) {
        // Mirrors service.go CreateDriver: unknown parent maps ErrNotFound
        // to ErrInvalid -> 400 "unknown customer" (never a 404 here).
        return HttpResponse.json({ message: "unknown customer" }, { status: 400 });
      }
      const body = (await request.json()) as CreateDriverBody;
      const now = new Date().toISOString();
      const created: DriverResponse = {
        ...body,
        id: crypto.randomUUID(),
        customer_id: customerId,
        created_at: now,
        updated_at: now,
      };
      return HttpResponse.json<DriverResponse>(created, { status: 201 });
    },
  ),

  http.get(`${API_URL}/customers/:customerId/drivers`, ({ params }) => {
    const drivers = driversByCustomerId[params.customerId as string] ?? [];
    return HttpResponse.json<DriverResponse[]>(drivers, { status: 200 });
  }),
];
