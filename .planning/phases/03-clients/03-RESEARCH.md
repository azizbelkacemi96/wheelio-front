# Phase 3: Clients (Customers) - Research

**Researched:** 2026-07-27
**Domain:** Frontend feature module (React 19 + TanStack Router/Query + RHF/Zod) over the wheelio-api customer contract
**Confidence:** HIGH (backend contract read verbatim from Go source; frontend patterns read from existing phase-1/2 code)

## Summary

Phase 3 builds the customer (client) feature: a list/search screen replacing the `/clients` placeholder, a single create form with an individual↔company type toggle, and a detail screen. Every backend shape in this document was read directly from the Go source and is cited with `file:line` — the frontend `src/types/customer.ts` must mirror `customer_dto.go` 1:1, exactly as `src/types/fleet.ts` mirrors `fleet_dto.go`.

Two findings drive the whole plan. **First**, designated drivers are NOT nested in the customer-create payload — they are a separate endpoint (`POST /customers/:customerID/drivers`), so CUST-02 is a **create-then-attach sequence**: create the company customer, capture its returned `id`, then POST each driver row. **Second**, customers are **org-scoped, not agency-scoped** (unlike fleet): the backend authorizes via `Scope.HasOrgRole(min)` — read = viewer-or-above in *any* agency, write = agent-or-above in *any* agency, org admin implicit. The existing frontend `canOperate(scope, agencyId)` helper is agency-scoped and would be the WRONG gate here; a new `hasOrgRole` helper mirroring `scope.go:51` is required.

**Primary recommendation:** Clone the `src/features/fleet/` module structure into `src/features/customers/` (api.ts/queries.ts + screen components), reuse every `src/shared/ui/` primitive and the auth RHF+Zod form pattern verbatim, add `src/types/customer.ts` mirrored from `customer_dto.go`, and implement the create form as a Zod discriminated union keyed on `type`. Search is a single server-side `?q=` param. Do not build any new HTTP client, table, select, or field primitive.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Customer list + search | API (`GET /customers?q=`) | Client (render/state) | Backend owns search (`SearchCustomers`); no client-side query logic beyond the input |
| Create customer (individual/company) | API (`POST /customers`) | Client (RHF/Zod form) | Backend re-validates every field; client validation is UX only |
| Attach designated drivers | API (`POST /customers/:id/drivers`) | Client (sequenced mutation) | Separate endpoint; client orchestrates create-then-attach |
| Customer detail + its drivers | API (`GET /customers/:id`, `GET /customers/:id/drivers`) | Client (render) | Two reads; drivers are a child collection |
| Role gating (who can create/view) | API (`Scope.HasOrgRole`) | Client (UX hide/show) | Backend is the security boundary; client mirror is cosmetic |
| Data caching / refetch | Client (TanStack Query) | — | Query keys `["customers", ...]` |

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
| # | Decision |
|---|----------|
| D-01 | Customer LIST at `/clients` (replaces phase-1 placeholder), dense table (md+) / cards (<md), same pattern as VehicleList — reuse shared table/select/EmptyState/Skeleton primitives, do NOT rebuild them |
| D-02 | Individual vs company is a single entity with a `type`/`kind` discriminator. Create form is ONE route `/clients/nouveau` with a type toggle swapping the conditional field set — not two routes |
| D-03 | Designated drivers (company): repeatable sub-form (add/remove rows) — nested at create time IF backend accepts it, else create-then-attach sequence (researcher determines) |
| D-04 | Search: server-side if list endpoint exposes a query param, else client-side over fetched list — mirror VehicleList's server-filter + client-text-search split |
| D-05 | Customer DETAIL at `/clients/$customerId` showing identity/company fields + designated drivers (company). Phase 3 shows only what customer endpoints expose (no contract history — Phase 4) |
| D-06 | Forms: React Hook Form + Zod (phase-1 auth pattern), all copy via i18n FR+EN under a new top-level `customers.*` namespace, zero bare JSX literals |
| D-07 | Data layer mirrors `src/features/fleet/`: `src/features/customers/{api,queries}.ts` over shared `api` ky client, query keys `["customers", ...]`, agency scoping via currentAgencyId where API is agency-scoped (researcher confirms org vs agency) |
| D-08 | Role gating per backend Scope (CanOperate to create, CanRead to view — researcher confirms). No client-invented gates |
| D-09 | Algerian-specific fields (NIF/NIS/RC, identity doc types, wilaya if present) rendered with backend's exact enum values + i18n labels — never client-invented option sets |

### Claude's Discretion
- Exact component decomposition inside the customers feature module (following fleet's shape).
- Whether the type toggle is a radio-group, segmented control, or tabs (see Standard Stack).
- Form field ordering and i18n key naming under `customers.*`.

### Deferred Ideas (OUT OF SCOPE)
- NO customer edit/delete UI (create + search + view are the three CUST reqs). `PATCH` endpoints exist on the backend but are not wired this phase unless a success criterion needs them.
- NO contract history on customer detail (Phase 4).
- NO document upload for customers.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CUST-01 | Create individual customer: identity document + driving license | `POST /customers` with `type:"individual"`, `identity_doc_type` (`cin`/`passport`), `identity_doc_number`, `license_*` fields (contract table below) |
| CUST-02 | Create company customer RC/NIF/NIS + designated drivers | `POST /customers` with `type:"company"`, `legal_name`, `rc`, `nif`, `nis` → then `POST /customers/:id/drivers` per driver (create-then-attach sequence) |
| CUST-03 | Search / find existing customer | `GET /customers?q=<term>` — single free-text server-side param over name + CIN/RC |
</phase_requirements>

---

## Standard Stack

Everything needed is already installed. **No new npm dependencies.**

### Core (already in package.json — verified)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-hook-form | 7.82.0 | Form state, incl. `useFieldArray` for drivers | Phase-1 auth-form pattern [VERIFIED: package.json] |
| @hookform/resolvers | 5.4.0 | `zodResolver` bridge | Phase-1 pattern [VERIFIED] |
| zod | 4.4.3 | Schema validation, `z.discriminatedUnion` for type toggle | Phase-1 pattern [VERIFIED] |
| @tanstack/react-query | 5.101.4 | Query/mutation layer, `["customers", ...]` keys | Fleet pattern [VERIFIED] |
| @tanstack/react-router | 1.170.18 | File-based routes under `/clients` | Existing router [VERIFIED] |
| ky | 2.0.2 | Shared `api` client (`@/shared/api/client`) — NEVER instantiate a second client | Fleet api.ts [VERIFIED] |
| react-i18next / i18next | 17.0.10 / 26.3.6 | `customers.*` namespace FR+EN | Phase-1 i18n [VERIFIED] |
| radix-ui | ^1.6.4 | Unified primitives package (exports `RadioGroup`, `Tabs`, etc.) for the type toggle | Shared UI already built on it [VERIFIED] |

### Shared UI primitives to REUSE (do not rebuild — D-01)
`src/shared/ui/`: `button`, `input`, `select`, `card`, `table`, `skeleton`, `empty-state`, `field` (`Field`/`FieldGroup`/`FieldLabel`/`FieldError`), `badge`, `separator`, `label`. All read from `src/shared/ui/` inventory [VERIFIED].

### Type-toggle component — decision needed (Claude's Discretion, D-02)
There is **no** `radio-group.tsx`, `tabs.tsx`, or `toggle-group.tsx` in `src/shared/ui/` today [VERIFIED: `ls src/shared/ui/`]. `field.tsx` already has styling hooks for `[data-slot=radio-group]` (field.tsx:13,59) but the primitive itself is absent. Two viable paths:

1. **Hand-author `src/shared/ui/radio-group.tsx`** from the unified `radix-ui` package (`import { RadioGroup } from "radix-ui"`) — one small file, fully accessible, matches how the other shared primitives were authored. **Recommended.**
2. **`npx shadcn@4.14 add radio-group`** — pulls the canonical shadcn file. Note the project uses the unified `radix-ui` package (not per-primitive `@radix-ui/react-*`), so the generated import may need a one-line adjust; hand-authoring avoids the drift.

Do NOT use a bare pair of `<Button>`s with `aria-pressed` for a mutually-exclusive choice — a radiogroup is the correct a11y role for one-of-two. Since `type` is locked after creation, the toggle only exists on the create form.

**Installation:** none. If hand-authoring the radio-group, no package install — `radix-ui@1.6.4` already present.

## Package Legitimacy Audit

No external packages are installed this phase — every dependency is already present and was introduced/verified in phases 1–2. **No legitimacy gate required.**

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Backend API Contract (source of truth — cite these on every type)

Base URL: the ky client prefixes `/v1` (MSW uses `http://localhost:8080/v1`). All paths below are relative to that base. Routes registered in `server.go:115-123`.

### Endpoints
| Method | Path | Handler (file:line) | Purpose | Phase 3 use |
|--------|------|---------------------|---------|-------------|
| POST | `/customers` | `customer_handler.go:22` (`Create`) | Create individual OR company | CUST-01, CUST-02 |
| GET | `/customers?q=<term>` | `customer_handler.go:58` (`List`) | Search by name/CIN/RC; empty `q` = broad default | CUST-03, list |
| GET | `/customers/:customerID` | `customer_handler.go:70` (`Get`) | Fetch one customer | detail |
| PATCH | `/customers/:customerID` | `customer_handler.go:82` (`Update`) | Mutate non-pivot fields | OUT OF SCOPE (no edit UI) |
| POST | `/customers/:customerID/drivers` | `customer_handler.go:118` (`CreateDriver`) | Attach a designated driver | CUST-02 |
| GET | `/customers/:customerID/drivers` | `customer_handler.go:147` (`ListDrivers`) | List a customer's drivers | detail |
| GET | `/drivers?license_number=<n>` | `customer_handler.go:178` (`SearchDrivers`) | Search drivers by license | not needed this phase |
| GET | `/drivers/:driverID` | `customer_handler.go:165` (`GetDriver`) | Fetch one driver | not needed this phase |
| PATCH | `/drivers/:driverID` | `customer_handler.go:190` (`UpdateDriver`) | Mutate a driver | OUT OF SCOPE |

**Status codes:** `POST /customers` → **201** (`customer_handler.go:53`); `POST /customers/:id/drivers` → **201** (`:144`); all GETs → **200**; PATCH → 200. Validation failure (bind/validate) → 400 via `bindAndValidate`. Unknown parent customer on driver create → the service maps `ErrNotFound` to `ErrInvalid` → **400** with message `"unknown customer"` (`service.go` CreateDriver). Insufficient role → **403** (`"insufficient role for customer records"`, `service.go:authorize`). Missing customer on Get → 404 (`ErrNotFound`).

### `createCustomerRequest` — POST /customers body (`customer_dto.go:18-35`)
| JSON field | Type | Validate rule | Applies to | Notes |
|-----------|------|---------------|-----------|-------|
| `type` | string | `required,oneof=individual company` | both | **discriminator** |
| `full_name` | string | `omitempty,max=200` | individual (required by domain) | domain requires non-empty for individual (`customer.go:161`) |
| `identity_doc_type` | string | `omitempty,oneof=cin passport` | individual | domain requires cin\|passport (`customer.go:103`) |
| `identity_doc_number` | string | `omitempty,max=30` | individual | **pivot, required when `cin`** (1–20 chars, `customer.go:91`); optional when `passport` |
| `license_number` | string | `omitempty,max=30` | both | optional; if present 1–30 chars |
| `license_issued_at` | string\|null | `omitempty,datetime=2006-01-02` | both | `YYYY-MM-DD` |
| `license_valid_until` | string\|null | `omitempty,datetime=2006-01-02` | both | must be **after** issued_at (`customer.go:203`) |
| `legal_name` | string | `omitempty,max=200` | company (required by domain) | domain requires non-empty for company (`customer.go:167`) |
| `rc` | string | `omitempty,max=30` | company | **pivot, required for company** (1–30 chars, `customer.go:106`) |
| `nif` | string | `omitempty,max=30` | company | optional |
| `nis` | string | `omitempty,max=30` | company | optional |
| `phone` | string | `omitempty,max=30` | both | optional |
| `address` | string | `omitempty,max=300` | both | optional |

> ⚠️ The transport-layer `validate` tags are lenient (`omitempty`) — the true per-type requiredness (full_name for individual, legal_name+rc for company, identity_doc_number when cin) is enforced in the **domain** (`customer.go` `applyDetails`/`NewCustomer`). The client Zod schema must encode the domain rules, not just the loose DTO tags.

### `createDriverRequest` — POST /customers/:id/drivers body (`customer_dto.go:53-58`)
| JSON field | Type | Validate rule |
|-----------|------|---------------|
| `full_name` | string | `required,max=200` |
| `license_number` | string | `required,max=30` |
| `license_issued_at` | string\|null | `omitempty,datetime=2006-01-02` |
| `license_valid_until` | string\|null | `omitempty,datetime=2006-01-02` (must be after issued_at, `driver.go:75`) |

Note: driver `full_name` and `license_number` are **required** (unlike the customer's optional license). `customer_id` is a path param, not a body field.

### `customerResponse` — GET/POST response (`customer_dto.go:69-89`)
| JSON field | Type | omitempty | Notes |
|-----------|------|-----------|-------|
| `id` | string (uuid) | no | |
| `type` | string | no | `"individual"` \| `"company"` |
| `full_name` | string | yes | |
| `identity_doc_type` | string | yes | `"cin"` \| `"passport"` |
| `identity_doc_number` | string | yes | |
| `license_number` | string | yes | |
| `license_issued_at` | string\|null | yes | `YYYY-MM-DD` |
| `license_valid_until` | string\|null | yes | `YYYY-MM-DD` |
| `legal_name` | string | yes | |
| `rc` | string | yes | |
| `nif` | string | yes | |
| `nis` | string | yes | |
| `phone` | string | yes | |
| `address` | string | yes | |
| `created_at` | string | no | ISO 8601 (`time.Time`) |
| `updated_at` | string | no | ISO 8601 |

> **omitempty rule (same as fleet types):** every `omitempty` Go field is optional (`?:`) in TS and ABSENT from JSON when empty — never `null` or `""`. Exceptions: the two license dates are `*string` so they serialize as `null` or absent. In TS model them `string | null` / optional and normalize with `?? null`. `archived_at` exists on the domain entity but is **NOT** in the response DTO — do not model it.

### `driverResponse` (`customer_dto.go:91-100`)
| JSON field | Type | omitempty |
|-----------|------|-----------|
| `id` | string (uuid) | no |
| `customer_id` | string (uuid) | no |
| `full_name` | string | no |
| `license_number` | string | no |
| `license_issued_at` | string\|null | yes |
| `license_valid_until` | string\|null | yes |
| `created_at` | string | no |
| `updated_at` | string | no |

### Every enum — exact string values
| Enum | Values | Source |
|------|--------|--------|
| customer `type` | `"individual"`, `"company"` | `customer.go:20-22` (`CustomerTypeIndividual`/`CustomerTypeCompany`) |
| `identity_doc_type` | `"cin"`, `"passport"` | `customer.go:89-101`, DTO `oneof=cin passport` (`customer_dto.go:22`) |

**No wilaya enum, no legal-form enum, no address structure** — `address` is a free single string (max 300), `phone` a free string (max 30). Do NOT invent a wilaya dropdown (D-09 forbids client-invented option sets). CIN/RC/NIF/NIS/license numbers have **no format regex** on the backend by design (`customer.go:221-232` comment: no reliable public format spec for Algerian documents) — the client must NOT add format regexes either, only length bounds mirroring the table above.

### Scoping & authorization (org-scoped — NOT agency-scoped)
Read from `service.go` `authorize` + `scope.go:51` `HasOrgRole`:
- **Read** (List/Get/ListDrivers/GetDriver/SearchDrivers): requires `HasOrgRole(viewer)` → viewer-or-above in ANY agency of the org, or org admin.
- **Write** (Create customer/driver, Update): requires `HasOrgRole(agent)` → agent-or-above in ANY agency, or org admin.
- Insufficient role → **403** (a real forbidden, not a 404 — `service.go:authorize` comment: customer records have no agency boundary to hide).
- All queries run in `tx.WithOrgScope(scope.OrgID, ...)` — **org-scoped, no `agency_id` param anywhere**. Unlike `GET /vehicles`, the customer endpoints take NO `agency_id` query param. `currentAgencyId` from the auth store is **irrelevant** to customer queries — do not add it to query keys or params (contrast with fleet's `["vehicles","list",{agencyId,status}]`).

**Frontend gate (D-08):** the existing `canOperate(scope, agencyId)` / `canRead(scope, agencyId)` in `permissions.ts` are **agency-scoped and WRONG here**. Add a new org-wide helper mirroring `scope.go:51`:
```ts
// src/shared/auth/permissions.ts — mirrors Scope.HasOrgRole (scope.go:48-59)
export function hasOrgRole(scope: Scope, min: AgencyRole): boolean {
  if (isOrgAdmin(scope)) return true;
  return Object.values(scope.agencyRoles).some((r) => RANK[r] >= RANK[min]);
}
// customer create gate:  hasOrgRole(scope, "agent")
// customer read gate:     hasOrgRole(scope, "viewer")
```

---

## The individual/company + drivers create sequence (D-03 resolved)

Drivers are a **separate endpoint** — the create-customer payload has NO drivers array (`createCustomerRequest`, `customer_dto.go:18-35`). CUST-02 is therefore a **two-step create-then-attach**:

```
1. POST /customers            { type:"company", legal_name, rc, nif?, nis?, phone?, address? }  → 201 { id, ... }
2. for each driver row:
     POST /customers/{id}/drivers   { full_name, license_number, license_issued_at?, license_valid_until? }  → 201
```

**Orchestration recommendation (TanStack Query mutation):**
- Sequence the driver POSTs **after** the customer 201 resolves (each driver needs the returned `customer.id`). Run them **sequentially** (`for … await`), not `Promise.all`, so a mid-list failure has a clear "created customer + first N drivers" state and the error points at a specific row.
- **Partial-failure semantics:** the customer is already persisted once step 1 returns 201. If a driver POST fails, do NOT roll back the customer (no transactional endpoint exists). Surface which drivers succeeded, keep the customer, and let the user retry the failed rows (or land on the detail page where remaining drivers can be re-added). Document this in the mutation's error copy.
- On full success: invalidate `["customers"]` and navigate to `/clients/$customerId`.
- **Individual customers (CUST-01) have no drivers** — the drivers sub-form only renders in the company branch; step 2 is skipped entirely.

---

## Architecture Patterns

### System Architecture Diagram
```
                         ┌────────────────────────────────────────────┐
  /clients (list) ──────▶│ CustomerList  ── useCustomersQuery(q) ──────┼──▶ GET /customers?q=
                         │   server-side search (?q=), table↔card      │
                         └────────────────────────────────────────────┘
                         ┌────────────────────────────────────────────┐
  /clients/nouveau ─────▶│ CustomerCreateForm (RHF + zodResolver)      │
                         │   ├─ type toggle (radio) ──┐                │
                         │   ├─ individual fields  ◀──┤ conditional    │
                         │   ├─ company fields     ◀──┘ (discriminated)│
                         │   └─ drivers useFieldArray (company only)   │
                         │        │                                    │
                         │        ▼ onSubmit                           │
                         │   useCreateCustomerMutation ────────────────┼──▶ POST /customers (201)
                         │        │ then, per driver row               │
                         │        ▼                                    │
                         │   POST /customers/:id/drivers (201) × N ────┼──▶ (sequential)
                         └────────────────────────────────────────────┘
                         ┌────────────────────────────────────────────┐
  /clients/$id ─────────▶│ CustomerDetail                              │
                         │   useCustomerQuery(id) ─────────────────────┼──▶ GET /customers/:id
                         │   useCustomerDriversQuery(id) (company) ────┼──▶ GET /customers/:id/drivers
                         └────────────────────────────────────────────┘
  All requests ──▶ shared ky `api` client (single-flight refresh, /v1 prefix) ──▶ wheelio-api
```

### Recommended Project Structure (mirror `src/features/fleet/`)
```
src/features/customers/
├── api.ts                 # thin ky calls: fetchCustomers(q), fetchCustomer(id),
│                          #   createCustomer(body), createDriver(customerId, body),
│                          #   fetchCustomerDrivers(id)
├── queries.ts             # useCustomersQuery(q), useCustomerQuery(id),
│                          #   useCustomerDriversQuery(id), useCreateCustomerMutation()
├── schemas.ts             # Zod discriminated union (individual|company) + driver schema
├── CustomerList.tsx       # list/search screen (table↔card, mirrors VehicleList)
├── CustomerCreateForm.tsx # RHF form + type toggle + drivers useFieldArray
├── CustomerDetail.tsx     # detail screen
└── CustomerTypeBadge.tsx  # optional, like StatusBadge

src/types/customer.ts      # verbatim mirror of customer_dto.go (CustomerResponse, DriverResponse, CustomerType, IdentityDocType)

src/routes/_authenticated/clients/    # convert clients.tsx → directory (mirror vehicules/)
├── index.tsx              # → CustomerList
├── nouveau.tsx            # → CustomerCreateForm
└── $customerId.tsx        # → CustomerDetail
```
> Routing note: `/clients` is currently a single flat file `clients.tsx`. To add children, convert it to a `clients/` directory with `index.tsx` (mirrors how `vehicules/` is structured with `index.tsx` + `$vehicleId.tsx`). Routes are generated by `scripts/generate-routes.mjs` (ignore pattern `\.test\.`).

### Pattern 1: api.ts over the shared client (D-07)
```ts
// src/features/customers/api.ts  — mirrors fleet/api.ts:10-33
import { api } from "@/shared/api/client";
import type { CustomerResponse, DriverResponse } from "@/types/customer";

export function fetchCustomers(q: string): Promise<CustomerResponse[]> {
  const searchParams = new URLSearchParams();
  if (q.trim() !== "") searchParams.set("q", q.trim());
  return api.get("customers", { searchParams }).json<CustomerResponse[]>();
}
export function fetchCustomer(id: string): Promise<CustomerResponse> {
  return api.get(`customers/${id}`).json<CustomerResponse>();
}
export function fetchCustomerDrivers(id: string): Promise<DriverResponse[]> {
  return api.get(`customers/${id}/drivers`).json<DriverResponse[]>();
}
export function createCustomer(body: CreateCustomerBody): Promise<CustomerResponse> {
  return api.post("customers", { json: body }).json<CustomerResponse>();
}
export function createDriver(customerId: string, body: CreateDriverBody): Promise<DriverResponse> {
  return api.post(`customers/${customerId}/drivers`, { json: body }).json<DriverResponse>();
}
```

### Pattern 2: query keys (D-07) — NO agencyId (org-scoped)
```ts
// src/features/customers/queries.ts — mirrors fleet/queries.ts but WITHOUT agencyId
useQuery({ queryKey: ["customers", "list", { q }], queryFn: () => fetchCustomers(q) });
useQuery({ queryKey: ["customers", "detail", id], queryFn: () => fetchCustomer(id) });
useQuery({ queryKey: ["customers", "detail", id, "drivers"], queryFn: () => fetchCustomerDrivers(id) });
```
> `currentAgencyId` is deliberately absent — customer endpoints are org-scoped and take no `agency_id` param. Adding it would be a bug (needless cache fragmentation + a param the server ignores).

### Pattern 3: Zod discriminated union for the type toggle (D-02, D-06)
```ts
// src/features/customers/schemas.ts
import { z } from "zod";

const licenseDates = {
  license_number: z.string().max(30).optional(),
  license_issued_at: z.string().optional(),   // YYYY-MM-DD
  license_valid_until: z.string().optional(),
};

const individual = z.object({
  type: z.literal("individual"),
  full_name: z.string().min(1).max(200),                    // domain-required (customer.go:161)
  identity_doc_type: z.enum(["cin", "passport"]),
  identity_doc_number: z.string().max(30).optional(),        // required-when-cin refined below
  ...licenseDates,
});

const company = z.object({
  type: z.literal("company"),
  legal_name: z.string().min(1).max(200),                    // domain-required (customer.go:167)
  rc: z.string().min(1).max(30),                             // pivot, required (customer.go:106)
  nif: z.string().max(30).optional(),
  nis: z.string().max(30).optional(),
  ...licenseDates,
});

const shared = { phone: z.string().max(30).optional(), address: z.string().max(300).optional() };

export const customerSchema = z
  .discriminatedUnion("type", [individual.extend(shared), company.extend(shared)])
  .refine(
    (v) => v.type !== "individual" || v.identity_doc_type !== "cin" || (v.identity_doc_number?.trim().length ?? 0) >= 1,
    { path: ["identity_doc_number"], message: "customers.errors.cinRequired" }, // i18n key
  )
  .refine(
    (v) => !v.license_issued_at || !v.license_valid_until || v.license_valid_until > v.license_issued_at,
    { path: ["license_valid_until"], message: "customers.errors.licenseDateOrder" },
  );

export const driverSchema = z.object({
  full_name: z.string().min(1).max(200),
  license_number: z.string().min(1).max(30),
  license_issued_at: z.string().optional(),
  license_valid_until: z.string().optional(),
});
```
> Validation messages are i18n keys resolved via `t()` at render (D-06). Since `errors` from RHF carry the raw message, pass it through `t()` in the `FieldError` boundary, matching the auth form convention.

### Pattern 4: drivers repeatable sub-form with `useFieldArray` (D-03)
```ts
// inside CustomerCreateForm, company branch only
import { useForm, useFieldArray } from "react-hook-form";

const form = useForm<CustomerFormValues>({ resolver: zodResolver(...), defaultValues: { type: "company", drivers: [] } });
const { fields, append, remove } = useFieldArray({ control: form.control, name: "drivers" });

// render: fields.map((f, i) => <DriverRow key={f.id} index={i} onRemove={() => remove(i)} register={register} />)
// add:    <Button type="button" onClick={() => append({ full_name: "", license_number: "" })}>{t("customers.drivers.add")}</Button>
```
> `useFieldArray` requires `key={field.id}` (RHF's generated id, NOT the array index — index keys corrupt state on remove). `drivers` lives in the form values only for the company branch; on submit, POST the customer first, then iterate `data.drivers`.

### Anti-Patterns to Avoid
- **Instantiating a second ky/fetch client** — always use `@/shared/api/client` (fleet api.ts:10 comment).
- **Adding `agency_id` to customer requests/keys** — customers are org-scoped; the param does not exist server-side.
- **Using `canOperate(scope, agencyId)` to gate customer create** — wrong scope; use `hasOrgRole(scope, "agent")`.
- **`key={index}` in the drivers field array** — use `field.id`.
- **Client-side format regex on CIN/RC/NIF/NIS/license** — backend deliberately has none (`customer.go:221`).
- **Two separate create routes** — one `/clients/nouveau` with the type toggle (D-02).
- **Rendering an `archived_at` field** — not in the response DTO.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Conditional individual/company validation | Manual `if type === …` branching | `z.discriminatedUnion("type", …)` | Type-safe, single source, RHF-native |
| Add/remove driver rows | Local `useState` array + manual index mgmt | RHF `useFieldArray` | Handles keys, registration, reset correctly |
| Form state/validation/submit | Controlled inputs by hand | `react-hook-form` + `zodResolver` | Phase-1 auth pattern already proven |
| Responsive list | New table/card components | Reuse `Table`/`Card` + the VehicleList md/`md:hidden` split | D-01 |
| Empty/loading/error states | Custom | `EmptyState` + `Skeleton` + the VehicleList error/retry block | D-01 |
| Type toggle a11y | Two buttons w/ `aria-pressed` | Radix `RadioGroup` (unified `radix-ui`) | Correct radiogroup role for one-of-two |
| HTTP + auth refresh | New client | Shared `api` ky client | Single-flight refresh interceptor |

**Key insight:** This phase is almost entirely composition of existing phase-1/2 primitives plus one Zod discriminated union and one `useFieldArray`. The only genuinely new UI atom is the type-toggle radio-group.

## Common Pitfalls

### Pitfall 1: Assuming drivers are nested in customer-create
**What goes wrong:** Building a single POST with a `drivers: [...]` array → 400/ignored; drivers never persist.
**Why:** `createCustomerRequest` (`customer_dto.go:18-35`) has no drivers field; drivers are a separate endpoint (`server.go:119`).
**How to avoid:** Implement create-then-attach; sequence driver POSTs after the customer 201.
**Warning signs:** Drivers absent on the detail page after "successful" company creation.

### Pitfall 2: Contract drift in `src/types/customer.ts`
**What goes wrong:** TS field names diverge from Go JSON tags (e.g. `identityDocType` vs `identity_doc_type`) → silent undefined at runtime.
**Why:** The response uses snake_case JSON tags; omitempty fields are absent, not null.
**How to avoid:** Mirror `customer_dto.go` verbatim (snake_case, `?:` for every omitempty). Type MSW handler bodies against these types so drift fails compilation (handlers.ts convention).
**Warning signs:** `customer.legal_name` undefined; TS compiles because the type was hand-guessed.

### Pitfall 3: Discriminated-union validation leaking the wrong fields
**What goes wrong:** Submitting `rc` on an individual, or `identity_doc_number` on a company; or requiredness not enforced because you used a flat schema with all-optional fields.
**Why:** The loose DTO `omitempty` tags don't encode per-type requiredness — the domain does (full_name for individual, legal_name+rc for company, cin number when cin).
**How to avoid:** `z.discriminatedUnion` + the two `.refine`s above; only send the active branch's fields.
**Warning signs:** Backend 400 `"legal name is required"` / `"RC must be between 1 and 30"` despite a "valid" client form.

### Pitfall 4: Driver array edge cases (empty / one / many)
**What goes wrong:** Empty company (zero drivers) blocked unnecessarily; a single-row remove leaving a broken field array; many rows submitted in parallel racing the customer id.
**Why:** Drivers are optional (a company can have zero at creation); `useFieldArray` remove needs `field.id` keys; driver POSTs need the customer id from step 1.
**How to avoid:** Allow 0 drivers (skip step 2). Use `field.id` keys. Sequence POSTs (`for … await`) after the customer resolves.
**Warning signs:** Cannot create a company without adding a driver; removing the last driver row throws; drivers POST with `undefined` customer id.

### Pitfall 5: Wrong role gate (agency vs org)
**What goes wrong:** Using `canOperate(scope, currentAgencyId)` hides the create button for users who ARE allowed (agent in a *different* agency), or shows a 403-bound button.
**Why:** Customer authz is org-wide `HasOrgRole` (`scope.go:51`), not per-agency.
**How to avoid:** Add and use `hasOrgRole(scope, "agent" | "viewer")`.
**Warning signs:** Create button visibility diverges from the backend's 403 behavior.

### Pitfall 6: E2E placeholder regression (see dedicated warning below)

---

## ⚠️ E2E Placeholder-Migration Warning (blocking for the planner)

`e2e/auth.spec.ts` asserts the "Bientôt disponible" placeholder on **`/clients`** in three tests — this WILL break the moment `/clients` becomes the real CustomerList screen. The planner MUST migrate these assertions to a still-placeholder route.

**Exact locations (`e2e/auth.spec.ts`):**
- Lines 150-155 (owner test): clicks "Clients" link → asserts `/clients` URL + "Bientôt disponible" heading + body copy.
- Lines 181-183 (agent test): clicks "Clients" → asserts `/clients` + "Bientôt disponible".
- Lines 217-232 (language switcher test): navigates to `/clients` → asserts FR "Bientôt disponible", then EN "Coming soon".

**Still-placeholder routes to migrate onto:** `/contrats` (nav label FR "Contrats" / EN — check) or `/etats-des-lieux` (nav label FR "États des lieux" / EN "Inspections"). Both remain `EmptyState` placeholders through Phase 3 (verified: `contrats.tsx`, `etats-des-lieux.tsx` still render EmptyState; only `/vehicules` and now `/clients` become real). Recommend **`/etats-des-lieux`** (it has a confirmed EN nav label "Inspections" used at auth.spec.ts:231, so the language-switcher test's nav-label assertions still work). Nav link labels used by `getByRole("link", {name})`: FR "États des lieux", and the test already checks EN "Inspections" (line 231).

**Also update `src/routes/_authenticated/placeholders.test.tsx`:** it imports and asserts `ClientsRoute` renders the shared EmptyState (lines 18, 32, 56-63, 84). Once `/clients` is real, remove `ClientsRoute` from `allPlaceholderRoutes` and from the standalone FR/EN tests (mirroring how the file already notes `/vehicules` was removed after phase 02, lines 30-31). Repoint the standalone "base placeholder" example test (lines 56-81, currently using `ClientsRoute`) to `ContratsRoute` or `EtatsDesLieuxRoute`.

**Planner action:** add an explicit task to (1) migrate the three `auth.spec.ts` `/clients` blocks to a still-placeholder route, and (2) update `placeholders.test.tsx` to drop `ClientsRoute`. This is a required regression fix, not optional.

---

## Runtime State Inventory

Not applicable — greenfield feature addition, no rename/refactor/migration. No stored data, service config, OS-registered state, secrets, or build artifacts carry a name that changes. **None — verified: this phase only adds new files + converts one placeholder route to real screens.**

## Common i18n additions

New top-level `customers.*` namespace in `src/shared/i18n/{fr,en}/common.json` (D-06). The nav label `nav.customers` ("Clients"/"Clients") already exists (verified). Expected sub-keys (mirror `vehicles.*` shape): `title`, `searchPlaceholder`, `columns.*`, `type.individual`, `type.company`, `identityDocType.cin`, `identityDocType.passport`, `create.*`, `fields.*` (fullName, legalName, rc, nif, nis, identityDocNumber, licenseNumber, licenseIssuedAt, licenseValidUntil, phone, address), `drivers.*` (title, add, remove, fullName, licenseNumber), `errors.*` (cinRequired, licenseDateOrder, createFailed, driverFailed), `empty.*`, `noResults`, `loadError`, `retry`, `detail.*`. Add a `customerCount_one/_other` pluralization pair mirroring `vehicleCount` (common.json top level).

## Code Examples

### List screen search (server-side ?q=, mirrors VehicleList but server-driven search)
```tsx
// CustomerList.tsx — search is SERVER-side here (unlike fleet's client-side text filter),
// because the backend List endpoint IS the search (GET /customers?q=). Debounce the input
// into the query key, or search on submit. Keep the table↔card responsive split from VehicleList.
const [q, setQ] = useState("");
const query = useCustomersQuery(q);        // queryKey ["customers","list",{q}]
const customers = query.data ?? [];
// display name: type === "company" ? legal_name : full_name
```
> Contrast with VehicleList (fleet/queries.ts:12): fleet filters text client-side over an unpaginated array; customers filter server-side via `?q=`. D-04 resolves to **server-side** since the param exists. No pagination on either side (the endpoint returns a full slice).

### Type display helper
```ts
function customerDisplayName(c: CustomerResponse): string {
  return c.type === "company" ? c.legal_name ?? "" : c.full_name ?? "";
}
```

## State of the Art

| Old Approach | Current Approach | When | Impact |
|--------------|------------------|------|--------|
| Per-primitive `@radix-ui/react-*` imports | Unified `radix-ui` package (v1.6.4) | already adopted | New radio-group imports `from "radix-ui"` |
| Zod `z.union` + manual narrowing | `z.discriminatedUnion` | zod 3.20+/4.x | Cleaner type-toggle validation |
| shadcn per-component CLI | shadcn 4.14 (installed) | current | `npx shadcn add` available but hand-authoring preferred for the unified-radix drift |

**Deprecated/outdated:** none relevant.

## Environment Availability

Skipped — no new external tools/services. All deps installed (verified against package.json); the app runs under the existing Vite/Vitest/Playwright toolchain.

## Validation Architecture

> nyquist_validation is enabled (config.json `workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (jsdom) + @testing-library/react 16.3.2 + MSW 2.15.0; Playwright 1.61.1 for e2e |
| Config file | `vitest.config.ts` (setup `src/test/setup.ts`; excludes `e2e/**`) |
| Quick run command | `npx vitest run src/features/customers` |
| Full suite command | `npx vitest run` (unit) + `npx playwright test` (e2e) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CUST-01 | Create individual (cin required when cin type; passport optional) | component | `npx vitest run src/features/customers/CustomerCreateForm.test.tsx` | ❌ Wave 0 |
| CUST-02 | Create company + attach drivers (create-then-attach sequence) | component + MSW | `npx vitest run src/features/customers/CustomerCreateForm.test.tsx` | ❌ Wave 0 |
| CUST-02 | Driver array add/remove (empty/one/many) | component | same file | ❌ Wave 0 |
| CUST-03 | Search list by `?q=` returns filtered set | component + MSW | `npx vitest run src/features/customers/CustomerList.test.tsx` | ❌ Wave 0 |
| — | Type toggle swaps conditional field set | component | `CustomerCreateForm.test.tsx` | ❌ Wave 0 |
| — | Detail renders customer + drivers | component + MSW | `CustomerDetail.test.tsx` | ❌ Wave 0 |
| — | `src/types/customer.ts` matches contract | type-check | `npx tsc --noEmit` (MSW bodies typed) | ❌ Wave 0 |
| — | Route wiring `/clients`, `/clients/nouveau`, `/clients/$customerId` | route | `npx vitest run src/routes/_authenticated/clients` | ❌ Wave 0 |
| REGRESSION | e2e placeholder migrated off `/clients`; placeholders.test drops ClientsRoute | e2e + component | `npx playwright test e2e/auth.spec.ts` + `npx vitest run src/routes/_authenticated/placeholders.test.tsx` | ✅ exists (must edit) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/features/customers`
- **Per wave merge:** `npx vitest run` (full unit) + `npx tsc --noEmit`
- **Phase gate:** full unit suite green + `npx playwright test` green (incl. migrated placeholder assertions) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/test/mocks/handlers.ts` — add customer handlers: `GET /customers` (parse `?q=`, filter fixtures over name/rc/cin), `POST /customers` (201, echo body + id/timestamps), `GET /customers/:id` (200/404), `POST /customers/:id/drivers` (201), `GET /customers/:id/drivers` (200). MSW v2 matches path only — parse `?q` from `request.url` (handlers.ts existing convention).
- [ ] `src/test/fixtures/customers.ts` — individual + company customer fixtures + driver fixtures (mirror `fixtures/fleet.ts`).
- [ ] `src/features/customers/*.test.tsx` — form (conditional branches, cin-required refine, license date order, driver add/remove empty/one/many, create-then-attach sequence + partial-failure), list (search, empty, no-results, error/retry), detail.
- [ ] `src/routes/_authenticated/clients/*` route tests.
- [ ] **Edit** `e2e/auth.spec.ts` (migrate 3 `/clients` placeholder blocks) and `src/routes/_authenticated/placeholders.test.tsx` (drop ClientsRoute).
- [ ] Framework install: none — all present.

## Security Domain

> security_enforcement enabled (config.json `security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: high`).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (inherited) | Shared ky client's single-flight refresh; no new auth surface |
| V3 Session Management | no (inherited) | Access token in memory, refresh in localStorage (phase-1 store) |
| V4 Access Control | yes | Client mirrors `hasOrgRole` (viewer read / agent write); **backend is the boundary** — re-enforced on every request (403 on insufficient role). Client gate is UX only |
| V5 Input Validation | yes | Zod discriminated union + length bounds mirroring DTO; backend `bindAndValidate` + domain re-validate independently. **No client format regex** (backend has none by design) |
| V6 Cryptography | no | No crypto in this feature |
| V7 Error Handling | yes | Do not leak backend internals; render i18n error copy. 403 → generic "insufficient permissions"; 400 → field/summary error |

### Known Threat Patterns for React + REST customer PII
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| PII (identity docs, license, RC/NIF) exposure via logs | Information Disclosure | Never `console.log` customer payloads; PII stays in memory/query cache only |
| Broken access control (viewing/creating out of role) | Elevation of Privilege | `hasOrgRole` gate + backend 403 (never trust client gate) |
| Injection via free-text fields (address/name) | Tampering | React escapes by default; no `dangerouslySetInnerHTML`; parameterized server-side |
| Over-posting immutable pivots (type/cin/rc) via edit | Tampering | No edit UI this phase; backend `updateCustomerRequest` structurally omits pivots (`customer_dto.go:41-51`) |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `GET /customers` returns an unpaginated full slice (no page/limit params) | API Contract | If large orgs paginate later, list needs paging — but handler (`customer_handler.go:58`) shows no pagination today |
| A2 | Recommend migrating e2e placeholder assertions onto `/etats-des-lieux` | E2E Warning | If a later phase makes États-des-lieux real too, re-migrate; `/contrats` is the fallback |
| A3 | Hand-authoring `radio-group.tsx` over `npx shadcn add` | Standard Stack | Either works; shadcn CLI may need a one-line import fix for the unified radix-ui package |

**All backend contract claims (endpoints, field names, enums, status codes, scoping, authz) are [VERIFIED] against the Go source at the cited file:line — not assumed.**

## Open Questions

1. **Debounce vs submit for the search input**
   - What we know: search is server-side `?q=`; the list is unpaginated.
   - What's unclear: whether to debounce keystrokes into the query key or search on Enter/submit.
   - Recommendation: debounce (~300ms) into `["customers","list",{q}]` — simplest, matches a live-search UX; no backend cost concern at agency scale.

2. **Detail-page drivers for individuals**
   - What we know: `POST /customers/:id/drivers` accepts a driver for ANY customer (individual or company — `service.go` CreateDriver comment "individuel ou entreprise").
   - What's unclear: whether the UI should show/allow drivers on individual customers.
   - Recommendation: per D-03/D-05, render drivers in the **company** branch only for Phase 3; individual drivers are backend-possible but out of the CUST-02 scope.

## Sources

### Primary (HIGH confidence — read verbatim)
- `wheelio-api/internal/adapter/httpapi/customer_handler.go` (endpoints, status codes, handler wiring)
- `wheelio-api/internal/adapter/httpapi/customer_dto.go` (request/response JSON field names, types, validate tags, omitempty)
- `wheelio-api/internal/domain/customer/customer.go` (type enum, identity_doc_type enum, per-type requiredness, pivot rules, no-regex policy)
- `wheelio-api/internal/domain/customer/driver.go` (driver model, required fields, date order)
- `wheelio-api/internal/usecase/customer/service.go` (org-scoped authz, HasOrgRole, create-driver parent check, error mapping)
- `wheelio-api/internal/domain/identity/scope.go:48-59` (HasOrgRole semantics)
- `wheelio-api/internal/adapter/httpapi/server.go:114-123` (route registration)
- Frontend: `src/features/fleet/{api,queries}.ts`, `VehicleList.tsx`, `src/features/auth/{schemas.ts,LoginForm.tsx}`, `src/types/fleet.ts`, `src/shared/ui/field.tsx`, `src/shared/auth/{store.ts,permissions.ts}`, `src/test/mocks/handlers.ts`, `e2e/auth.spec.ts`, `src/routes/_authenticated/{clients.tsx,placeholders.test.tsx,vehicules/index.tsx}`
- `package.json` (installed versions)

### Secondary (MEDIUM)
- `react-hook-form` `useFieldArray` and `z.discriminatedUnion` usage — standard library patterns, versions confirmed installed.

### Tertiary (LOW)
- None.

## Metadata

**Confidence breakdown:**
- API contract & enums: HIGH — read verbatim from Go source with file:line citations.
- Frontend patterns: HIGH — read from existing phase-1/2 code.
- Type-toggle component choice: MEDIUM — hand-author vs CLI is a discretionary call.

**Research date:** 2026-07-27
**Valid until:** 2026-08-26 (stable; re-verify only if the wheelio-api customer package changes)
