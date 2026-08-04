import { http, HttpResponse } from "msw";
import type {
  AgencyBody,
  AgencyResponse,
  AuthResponse,
  CreateUserBody,
  MeResponse,
  MembershipResponse,
  SetMemberBody,
  UserResponse,
} from "@/types/identity";
import type {
  ChangeStatusBody,
  CreateVehicleBody,
  MileageLogResponse,
  VehicleResponse,
  VehicleStatus,
} from "@/types/fleet";
import type { ContractResponse, ContractStatus } from "@/types/rental";
import type {
  CreateCustomerBody,
  CreateDriverBody,
  CustomerResponse,
  DriverResponse,
} from "@/types/customer";
import type {
  ActivateBody,
  CancelBody,
  CloseBody,
  CreateContractBody,
  DepositBody,
} from "@/types/rental";
import type {
  CreateInspectionBody,
  DamageResponse,
  DocumentResponse,
  InspectionResponse,
  RecordDamageBody,
} from "@/types/inspection";
import { ownerFixture } from "../fixtures/scope";
import { vehicleFixtures } from "../fixtures/fleet";
import { contractFixtures, contractsByVehicleId } from "../fixtures/contracts";
import { customerFixtures, driversByCustomerId } from "../fixtures/customers";
import type {
  CreditNoteBody,
  CreditNoteResponse,
  FiscalIdentityBody,
  InvoiceResponse,
  OrgFiscalIdentityResponse,
  RecordPaymentBody,
} from "@/types/billing";
import {
  inspectionDraftFixture,
  inspectionValidatedFixture,
  uploadedDocumentFixture,
} from "../fixtures/inspections";
import type { DashboardResponse } from "@/types/dashboard";
import {
  creditNoteFixture,
  invoiceIssuedFixture,
  orgFiscalIdentityFixture,
} from "../fixtures/billing";

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

/**
 * Base contract a lifecycle handler mutates: the matching fixture, or a
 * synthesized minimal `reserved` contract when the id isn't a fixture (so a
 * mutation test that POSTs against an arbitrary id still gets a well-shaped
 * echo carrying that id).
 */
function contractOr(contractId: string): ContractResponse {
  const found = contractFixtures.find((c) => c.id === contractId);
  if (found) return found;
  const now = new Date().toISOString();
  return {
    id: contractId,
    vehicle_id: vehicleFixtures[0].id,
    customer_id: customerFixtures[0].id,
    status: "reserved",
    starts_at: "2026-08-10T09:00:00.000Z",
    ends_at: "2026-08-15T09:00:00.000Z",
    created_at: now,
    updated_at: now,
  };
}

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

  // ---- Rentals lifecycle (Phase 4) ----
  // The per-vehicle GET list above already covers listing (now sourced from
  // fixtures/contracts so all four statuses are listable). These handlers add
  // the create/activate/close/cancel/get/deposit lifecycle. MSW v2 matches
  // paths only — each handler reads the JSON body itself.
  //
  // Overlap 409: the create handler is deterministic — it rejects (409
  // application/problem+json, RFC 7807) when the posted window intersects an
  // existing reserved/active contract on the same vehicle (fixtures'
  // overlapReservedA/B pair). A per-test `server.use(...)` override can also
  // force any variant; the default happy path returns 201 reserved.

  http.post(
    `${API_URL}/vehicles/:vehicleId/rental-contracts`,
    async ({ request, params }) => {
      const vehicleId = params.vehicleId as string;
      const body = (await request.json()) as CreateContractBody;

      if (body.ends_at <= body.starts_at) {
        return HttpResponse.json(
          { message: "ends_at must be after starts_at" },
          { status: 400 },
        );
      }

      const existing = (contractsByVehicleId[vehicleId] ?? []).filter(
        (c) => c.status === "reserved" || c.status === "active",
      );
      const overlaps = existing.some(
        (c) => body.starts_at < c.ends_at && c.starts_at < body.ends_at,
      );
      if (overlaps) {
        return HttpResponse.json(
          {
            type: "about:blank",
            title: "Conflict",
            status: 409,
            detail:
              "period overlaps an existing contract or unavailability on this vehicle",
            instance: `/v1/vehicles/${vehicleId}/rental-contracts`,
          },
          {
            status: 409,
            headers: { "Content-Type": "application/problem+json" },
          },
        );
      }

      const now = new Date().toISOString();
      const created: ContractResponse = {
        id: crypto.randomUUID(),
        vehicle_id: vehicleId,
        customer_id: body.customer_id,
        status: "reserved",
        starts_at: body.starts_at,
        ends_at: body.ends_at,
        created_at: now,
        updated_at: now,
      };
      return HttpResponse.json<ContractResponse>(created, { status: 201 });
    },
  ),

  http.get(`${API_URL}/rental-contracts/:contractId`, ({ params }) => {
    const contract = contractFixtures.find((c) => c.id === params.contractId);
    if (!contract) {
      return HttpResponse.json({ message: "contract not found" }, { status: 404 });
    }
    return HttpResponse.json<ContractResponse>(contract, { status: 200 });
  }),

  http.post(
    `${API_URL}/rental-contracts/:contractId/activate`,
    async ({ request, params }) => {
      const body = (await request.json()) as ActivateBody;
      const base = contractOr(params.contractId as string);
      const now = new Date().toISOString();
      return HttpResponse.json<ContractResponse>(
        {
          ...base,
          status: "active",
          actual_departure_at: body.actual_at ?? now,
          departure_mileage: body.mileage,
          departure_fuel_level: body.fuel,
          updated_at: now,
        },
        { status: 200 },
      );
    },
  ),

  http.post(
    `${API_URL}/rental-contracts/:contractId/close`,
    async ({ request, params }) => {
      const body = (await request.json()) as CloseBody;
      if (!Array.isArray(body.invoice_lines) || body.invoice_lines.length < 1) {
        return HttpResponse.json(
          { message: "at least one invoice line is required" },
          { status: 400 },
        );
      }
      const base = contractOr(params.contractId as string);
      const now = new Date().toISOString();
      return HttpResponse.json<ContractResponse>(
        {
          ...base,
          status: "closed",
          actual_return_at: body.actual_at ?? now,
          return_mileage: body.mileage,
          return_fuel_level: body.fuel,
          updated_at: now,
        },
        { status: 200 },
      );
    },
  ),

  http.post(
    `${API_URL}/rental-contracts/:contractId/cancel`,
    async ({ request, params }) => {
      const body = (await request.json()) as CancelBody;
      if (!body.reason || body.reason.trim() === "") {
        return HttpResponse.json(
          { message: "reason is required" },
          { status: 400 },
        );
      }
      const base = contractOr(params.contractId as string);
      const now = new Date().toISOString();
      return HttpResponse.json<ContractResponse>(
        {
          ...base,
          status: "cancelled",
          cancel_reason: body.reason,
          cancelled_at: now,
          updated_at: now,
        },
        { status: 200 },
      );
    },
  ),

  http.post(
    `${API_URL}/rental-contracts/:contractId/deposit`,
    async ({ request, params }) => {
      const body = (await request.json()) as DepositBody;
      const base = contractOr(params.contractId as string);
      const now = new Date().toISOString();
      return HttpResponse.json<ContractResponse>(
        {
          ...base,
          deposit_amount_cents: body.amount_cents,
          deposit_method: body.method,
          updated_at: now,
        },
        { status: 200 },
      );
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

  // ---- Inspections (Phase 5) ----
  // The happy path: create returns a draft inspection echoing kind/mileage/
  // fuel; record-damage echoes the body; attach returns 204; validate returns
  // a validated inspection; the photo upload returns a fresh documentResponse.
  // A per-test server.use(...) override forces the 409 (return-without-
  // departure), the 400 (validate photo gate), or a fail-then-succeed upload.

  http.post(
    `${API_URL}/rental-contracts/:contractId/inspections`,
    async ({ request, params }) => {
      const body = (await request.json()) as CreateInspectionBody;
      const now = new Date().toISOString();
      return HttpResponse.json<InspectionResponse>(
        {
          id: crypto.randomUUID(),
          contract_id: params.contractId as string,
          agency_id: vehicleFixtures[0].agency_id,
          kind: body.kind,
          status: "draft",
          mileage: body.mileage,
          fuel_level: body.fuel,
          created_at: now,
          updated_at: now,
        },
        { status: 201 },
      );
    },
  ),

  http.get(`${API_URL}/inspections/:inspectionId`, ({ params }) => {
    return HttpResponse.json<InspectionResponse>(
      { ...inspectionDraftFixture, id: params.inspectionId as string },
      { status: 200 },
    );
  }),

  http.post(
    `${API_URL}/inspections/:inspectionId/damages`,
    async ({ request, params }) => {
      const body = (await request.json()) as RecordDamageBody;
      const now = new Date().toISOString();
      return HttpResponse.json<DamageResponse>(
        {
          id: crypto.randomUUID(),
          inspection_id: params.inspectionId as string,
          zone: body.zone,
          damage_type: body.damage_type,
          severity: body.severity,
          position: body.position,
          description: body.description,
          created_at: now,
        },
        { status: 201 },
      );
    },
  ),

  http.get(`${API_URL}/inspections/:inspectionId/damages`, () => {
    return HttpResponse.json<DamageResponse[]>([], { status: 200 });
  }),

  http.post(`${API_URL}/inspections/:inspectionId/validate`, ({ params }) => {
    const now = new Date().toISOString();
    return HttpResponse.json<InspectionResponse>(
      { ...inspectionValidatedFixture, id: params.inspectionId as string, validated_at: now },
      { status: 200 },
    );
  }),

  http.post(`${API_URL}/inspection-damages/:damageId/photos`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API_URL}/vehicles/:vehicleId/documents`, () => {
    return HttpResponse.json<DocumentResponse>(
      { ...uploadedDocumentFixture, id: crypto.randomUUID() },
      { status: 201 },
    );
  }),

  // ---- Billing (Phase 6) ----
  // Invoices are created by the backend at contract close; here the list and
  // detail serve the issued fixture. Payment recomputes the status (paid when
  // the amount clears the TTC due, else partially_paid). Credit-note voids.
  // Fiscal-identity PATCH echoes the posted body. PDFs stream a minimal blob.

  http.get(`${API_URL}/rental-contracts/:contractId/invoices`, () => {
    return HttpResponse.json<InvoiceResponse[]>([invoiceIssuedFixture], { status: 200 });
  }),

  http.get(`${API_URL}/invoices/:invoiceId`, ({ params }) => {
    return HttpResponse.json<InvoiceResponse>(
      { ...invoiceIssuedFixture, id: params.invoiceId as string },
      { status: 200 },
    );
  }),

  http.post(`${API_URL}/invoices/:invoiceId/payments`, async ({ request, params }) => {
    const body = (await request.json()) as RecordPaymentBody;
    const status =
      body.amount_cents >= invoiceIssuedFixture.total_ttc_cents ? "paid" : "partially_paid";
    return HttpResponse.json<InvoiceResponse>(
      { ...invoiceIssuedFixture, id: params.invoiceId as string, status },
      { status: 200 },
    );
  }),

  http.post(`${API_URL}/invoices/:invoiceId/credit-notes`, async ({ request, params }) => {
    const body = (await request.json()) as CreditNoteBody;
    return HttpResponse.json<CreditNoteResponse>(
      { ...creditNoteFixture, invoice_id: params.invoiceId as string, reason: body.reason },
      { status: 201 },
    );
  }),

  http.patch(`${API_URL}/organization/fiscal-identity`, async ({ request }) => {
    const body = (await request.json()) as FiscalIdentityBody;
    return HttpResponse.json<OrgFiscalIdentityResponse>(
      { ...orgFiscalIdentityFixture, ...body },
      { status: 200 },
    );
  }),

  http.get(`${API_URL}/invoices/:invoiceId/pdf`, () => pdfResponse()),
  http.get(`${API_URL}/rental-contracts/:contractId/pdf`, () => pdfResponse()),
  http.get(`${API_URL}/inspections/:inspectionId/pdf`, () => pdfResponse()),

  // ---- Fleet management (Phase 8) ----
  // Create echoes the body as a new `available` vehicle; PATCH/status echo the
  // mutation onto the first fixture; archive is 204; mileage log/list are the
  // odometer history (empty by default).

  http.post(`${API_URL}/vehicles`, async ({ request }) => {
    const body = (await request.json()) as CreateVehicleBody;
    const now = new Date().toISOString();
    return HttpResponse.json<VehicleResponse>(
      {
        id: crypto.randomUUID(),
        agency_id: body.agency_id,
        vin: body.vin,
        registration_plate: body.registration_plate,
        brand: body.brand,
        model: body.model,
        model_year: body.model_year,
        color: body.color,
        fuel_type: body.fuel_type,
        transmission: body.transmission,
        seats: body.seats,
        current_mileage: body.initial_mileage,
        status: "available",
        purchase_date: body.purchase_date,
        purchase_price_cents: body.purchase_price_cents,
        notes: body.notes,
        created_at: now,
        updated_at: now,
      },
      { status: 201 },
    );
  }),

  http.patch(`${API_URL}/vehicles/:vehicleId`, async ({ request, params }) => {
    const base =
      vehicleFixtures.find((v) => v.id === params.vehicleId) ?? vehicleFixtures[0];
    const body = (await request.json()) as Partial<VehicleResponse>;
    return HttpResponse.json<VehicleResponse>(
      { ...base, ...body, id: params.vehicleId as string, updated_at: new Date().toISOString() },
      { status: 200 },
    );
  }),

  http.patch(`${API_URL}/vehicles/:vehicleId/status`, async ({ request, params }) => {
    const base =
      vehicleFixtures.find((v) => v.id === params.vehicleId) ?? vehicleFixtures[0];
    const body = (await request.json()) as ChangeStatusBody;
    return HttpResponse.json<VehicleResponse>(
      { ...base, id: params.vehicleId as string, status: body.status, updated_at: new Date().toISOString() },
      { status: 200 },
    );
  }),

  http.delete(`${API_URL}/vehicles/:vehicleId`, () => new HttpResponse(null, { status: 204 })),

  http.post(`${API_URL}/vehicles/:vehicleId/mileage`, async ({ request }) => {
    const body = (await request.json()) as { mileage: number };
    return HttpResponse.json<MileageLogResponse>(
      {
        id: crypto.randomUUID(),
        mileage: body.mileage,
        source: "manual",
        recorded_at: new Date().toISOString(),
      },
      { status: 201 },
    );
  }),

  http.get(`${API_URL}/vehicles/:vehicleId/mileage`, () =>
    HttpResponse.json<MileageLogResponse[]>([], { status: 200 }),
  ),

  // ---- Documents (Phase 8) ----
  http.get(`${API_URL}/vehicles/:vehicleId/documents`, () =>
    HttpResponse.json([], { status: 200 }),
  ),
  http.get(`${API_URL}/documents/:documentId/download-url`, ({ params }) =>
    HttpResponse.json(
      {
        url: `${API_URL}/files/${params.documentId as string}?sig=mock`,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      },
      { status: 200 },
    ),
  ),
  http.delete(`${API_URL}/documents/:documentId`, () => new HttpResponse(null, { status: 204 })),
  http.get(`${API_URL}/documents/expiring`, () => HttpResponse.json([], { status: 200 })),

  // ---- Dashboard aggregate (KPIs) ----
  http.get(`${API_URL}/dashboard`, () =>
    HttpResponse.json<DashboardResponse>(
      {
        vehicles: { total: 5, available: 3, rented: 1, maintenance: 1 },
        contracts: { active: 1, reserved: 2 },
        today: { pickups: 1, returns: 1 },
        revenue_month_ttc_cents: 3129700,
        deposits_held_cents: 5000000,
        expiring_documents: 0,
        utilization_pct: 20,
        setup: { has_fiscal_identity: true, agencies: 1, vehicles: 5, customers: 3 },
      },
      { status: 200 },
    ),
  ),

  // ---- Admin: users, agencies, members (Phase 9) ----
  http.get(`${API_URL}/users`, () =>
    HttpResponse.json<UserResponse[]>(adminUsers, { status: 200 }),
  ),
  http.post(`${API_URL}/users`, async ({ request }) => {
    const body = (await request.json()) as CreateUserBody;
    return HttpResponse.json<UserResponse>(
      {
        id: crypto.randomUUID(),
        email: body.email,
        first_name: body.first_name,
        last_name: body.last_name,
        org_role: body.org_role,
        is_active: true,
        created_at: new Date().toISOString(),
      },
      { status: 201 },
    );
  }),
  http.post(`${API_URL}/agencies`, async ({ request }) => {
    const body = (await request.json()) as AgencyBody;
    const now = new Date().toISOString();
    return HttpResponse.json<AgencyResponse>(
      {
        id: crypto.randomUUID(),
        name: body.name,
        address_line: body.address_line,
        city: body.city,
        postal_code: body.postal_code,
        country_code: body.country_code ?? "DZ",
        phone: body.phone,
        created_at: now,
        updated_at: now,
      },
      { status: 201 },
    );
  }),
  http.patch(`${API_URL}/agencies/:agencyId`, async ({ request, params }) => {
    const base = defaultAgencies.find((a) => a.id === params.agencyId) ?? defaultAgencies[0];
    const body = (await request.json()) as AgencyBody;
    return HttpResponse.json<AgencyResponse>(
      { ...base, ...body, id: params.agencyId as string, updated_at: new Date().toISOString() },
      { status: 200 },
    );
  }),
  http.get(`${API_URL}/agencies/:agencyId/members`, () =>
    HttpResponse.json<MembershipResponse[]>([], { status: 200 }),
  ),
  http.put(`${API_URL}/agencies/:agencyId/members/:userId`, async ({ request, params }) => {
    const body = (await request.json()) as SetMemberBody;
    return HttpResponse.json<MembershipResponse>(
      {
        agency_id: params.agencyId as string,
        user_id: params.userId as string,
        role: body.role,
        created_at: new Date().toISOString(),
      },
      { status: 200 },
    );
  }),
  http.delete(`${API_URL}/agencies/:agencyId/members/:userId`, () =>
    new HttpResponse(null, { status: 204 }),
  ),
];

/** Users for the admin screens (Phase 9): the owner founder + one member. */
const adminUsers: UserResponse[] = [
  ownerFixture.me.user,
  {
    id: "99999999-9999-4999-8999-999999999999",
    email: "nadia@wheelio.dz",
    first_name: "Nadia",
    last_name: "Agent",
    org_role: "member",
    is_active: true,
    created_at: "2026-02-01T00:00:00.000Z",
  },
];

/** A minimal application/pdf response for the BILL-05 download handlers. */
function pdfResponse(): Response {
  return new HttpResponse(new Blob(["%PDF-1.4 mock"], { type: "application/pdf" }), {
    status: 200,
    headers: { "Content-Type": "application/pdf" },
  });
}
