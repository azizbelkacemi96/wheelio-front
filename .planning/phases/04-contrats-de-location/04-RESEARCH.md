# Phase 4: Contrats de location — Research

**Researched:** 2026-07-28
**Domain:** Rental lifecycle (reserve → activate → close/cancel), guided multi-step wizard, today overview dashboard
**Confidence:** HIGH (API contract read verbatim from Go source; frontend patterns read from shipped Phase 2/3 code)

## Summary

The backend rental module is fully implemented and the HTTP contract is stable. Every field, route, status code and authorization rule in this document was read directly from the Go source (`rental_handler.go`, `rental_dto.go`, `domain/rental/contract.go`, `usecase/rental/service.go`, `server.go`) — not inferred. The lifecycle is a clean state machine: a contract is **born `reserved`** by create, moves to `active` via activate (departure mileage+fuel), then `closed` via close (return mileage+fuel+invoice lines) or `cancelled` via cancel (reason). `closed` and `cancelled` are terminal. Overlap protection is a **double barrier** — an application pre-check plus a database `EXCLUDE` constraint — both surfacing as **HTTP 409 `application/problem+json`**.

**Two backend realities contradict assumptions baked into CONTEXT.md and MUST reshape the plan:**

1. **There is NO org-wide or agency-wide "list all contracts" endpoint.** The only list route is `GET /vehicles/:vehicleID/rental-contracts` (per single vehicle). D-02 (contracts list at `/contrats`) and D-07 (OPS-01 today overview) therefore **cannot be a single fetch** — both must be composed client-side by iterating the vehicles list and fetching each vehicle's contracts (N+1). CONTEXT D-07 correctly flagged this as an open question; the answer is definitive: **compose, no dedicated endpoint exists.**
2. **`contractResponse` carries only `customer_id` and `vehicle_id` (UUIDs) — no customer name, no vehicle plate, no `agency_id`.** Every list/detail/today view that shows a plate or a customer name, and every action-gate that needs the vehicle's agency, must resolve those via separate `vehicles`/`customers` fetches.

**Primary recommendation:** Build `src/features/contracts/` mirroring `features/fleet` + `features/customers` (api/queries/mutations/screens/wizard). Model the RENT-05 wizard as **ONE React Hook Form on ONE route `/contrats/nouveau`** with a local `useState` step index (no Zustand, no XState — RHF already survives step navigation without data loss). The wizard's finish sequence is a **multi-call create-then-activate** that reuses the exact partial-failure discipline from `customers/mutations.ts`. The Phase 4↔5 seam is clean and confirmed: **activate needs only `mileage`+`fuel`; the full photo/zone inspection is a separate `/inspections` endpoint owned by Phase 5.**

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Overlap rejection (RENT-01) | API / DB (EXCLUDE constraint) | Client (friendly-message mapping) | Anti-chevauchement is guaranteed by the database `EXCLUDE` + app pre-check `[VERIFIED: service.go:96-102]`; the client only translates the 409 |
| Contract state machine | API / Domain | Client (button gating mirror) | `contractTransitions` map lives in the domain `[VERIFIED: contract.go:27-30]`; client gates buttons but backend re-enforces |
| Contracts list `/contrats` | Client (composition) | API (per-vehicle list) | No list-all endpoint — client fans out over vehicles `[VERIFIED: server.go:129-139]` |
| OPS-01 today overview | Client (composition + date math) | API (per-vehicle list) | Same: no dashboard endpoint; client composes + does Africa/Algiers date filtering |
| Wizard state (RENT-05) | Client (React Hook Form) | — | Single-route, in-memory form; no server draft is created early |
| Customer name / vehicle plate display | Client (join) | API (customers, vehicles) | `contractResponse` has no denormalized names `[VERIFIED: rental_dto.go:83-105]` |
| Departure inspection photos/zones | API (Phase 5 `/inspections`) | Client (Phase 5) | Out of Phase 4 — activate needs only mileage+fuel `[VERIFIED: rental_dto.go:29-33]` |
| Invoice document + compliance | API (Phase 6) | Client (Phase 6) | Close only captures `invoice_lines`; issuance happens server-side in the close tx `[VERIFIED: service.go:214-221]` |

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

| # | Decision |
|---|----------|
| D-01 | Contract entity + statuses come from the backend enum (reserved/active/closed/cancelled — mirrored in `src/types/rental.ts`). Reuse `contracts.status.*` i18n already shipped. Never invent statuses. |
| D-02 | Contracts LIST at `/contrats` (replaces placeholder), dense table/cards, status filter + search, same pattern as fleet/customers. Columns: vehicle plate, customer, period, status. |
| D-03 | Contract DETAIL at `/contrats/$contractId`: full contract card (vehicle, customer, period, status, deposit, departure/return mileage+fuel) + lifecycle action buttons gated by current status (activate if reserved, close if active, cancel if reserved/active). |
| D-04 | Overlap rejection (RENT-01): backend enforces EXCLUDE → returns a conflict. UI maps to a clear friendly "ce véhicule est déjà réservé sur cette période" — never a raw 409/500. Distinct i18n key. |
| D-05 | GUIDED WIZARD (RENT-05) is the centerpiece — multi-step on ONE route `/contrats/nouveau`: Step 1 pick/confirm vehicle (reuse fleet list, filter available), Step 2 pick/create customer (reuse customer search + inline create), Step 3 contract terms (dates, deposit), Step 4 departure inspection handoff. Steps share state, progress indicator, back/next, no full-page reloads. Phase 5 owns full EDL; Phase 4 wires the handoff/stub with a clear seam. |
| D-05a | Wizard state model: research decides Zustand store vs single RHF form. Must survive step navigation without losing data; must NOT persist across full reload unless backend creates a draft early. |
| D-06 | Lifecycle mutations via TanStack Query over the shared api client; on success invalidate `["contracts", ...]` + the affected vehicle's `["vehicles", ...]`. |
| D-07 | OPS-01 today overview: `/` landing becomes a dashboard listing today's pickups (reserved starting today) + returns (active ending today). Researcher confirms whether a dedicated endpoint exists or it's composed. |
| D-08 | Close (RENT-03) records invoice LINES. Phase 4 captures return data + invoice-line entry the close endpoint requires; the actual INVOICE document/compliance is Phase 6. |
| D-09 | Role gating per backend Scope (rental handler authz — confirm CanOperate vs agency-scoped). Contracts are agency-scoped (vehicle-linked) unlike customers — confirm. |
| D-10 | All copy i18n FR+EN under `contracts.*` + new `wizard.*`/`ops.*` as needed, zero bare literals, FR/EN parity. Amounts in DZD, dates locale-formatted. |
| D-11 | Data layer mirrors features/fleet + features/customers: `src/features/contracts/` (api, queries, mutations, screens, wizard). Reuse shared primitives + fleet/customer queries for the wizard pickers. |

### Claude's Discretion
- Wizard state model choice (D-05a) — **researcher recommends: single RHF form + local step index. See Wizard Architecture.**
- OPS-01 composition strategy (D-07) — **researcher confirms: client-side composition, no endpoint.**
- Whether the vehicle picker uses the plain vehicles list (client-filtered) or `GET /vehicles/available` — **researcher recommends the plain list + 409-as-authority. See Pitfall 1.**

### Deferred Ideas (OUT OF SCOPE)
- Departure inspection FULL capture (photos, per-zone damage) → Phase 5 (`/inspections` endpoint).
- Invoice DOCUMENT + décret compliance + payments → Phase 6.
- Vehicle unavailability declaration (`POST /vehicles/:id/unavailability`), deposit return workflow tied to damages → not a RENT-01..05/OPS-01 requirement.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RENT-01 | Create reservation for available vehicle+customer; overlap rejected with friendly error, no silent double-booking | `POST /vehicles/:vehicleID/rental-contracts`; overlap → 409 problem+json (see API Contract + Overlap Error Shape) |
| RENT-02 | Activate: departure mileage + fuel level | `POST /rental-contracts/:contractID/activate` `{actual_at?, mileage, fuel}` |
| RENT-03 | Close: return mileage + fuel + invoice lines | `POST /rental-contracts/:contractID/close` `{actual_at?, mileage, fuel, invoice_lines[]}` |
| RENT-04 | Cancel reservation or active contract with a recorded reason | `POST /rental-contracts/:contractID/cancel` `{reason}` |
| RENT-05 | Guided wizard vehicle→customer→contract→departure inspection, ONE continuous flow (full version) | Single-route RHF wizard; finish = create → (deposit?) → activate; Phase 5 seam via `/inspections` |
| OPS-01 | Today overview: pickups + returns due today, on landing | Composed client-side from vehicles + per-vehicle contracts; Africa/Algiers date math |
</phase_requirements>

---

## Standard Stack

**No new npm dependencies are required for this phase.** Everything the wizard, list, detail and dashboard need is already installed. This was verified against `package.json`.

### Core (already installed — reuse)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | 5.101.4 | All server state (queries + lifecycle mutations, invalidation) | Established Phase 2/3 idiom `[VERIFIED: queries.ts, mutations.ts]` |
| `@tanstack/react-router` | 1.170.18 | File-based routes `/contrats`, `/contrats/$contractId`, `/contrats/nouveau` | Existing routing `[VERIFIED: src/routes]` |
| `react-hook-form` | 7.82.0 | The whole wizard form + close/activate/cancel forms | Powers customers form; `trigger()` enables step validation `[VERIFIED: CustomerCreateForm.tsx]` |
| `@hookform/resolvers` + `zod` | 5.4.0 / 4.4.3 | Per-step + payload validation | `zodResolver` established `[VERIFIED: schemas.ts]` |
| `ky` | 2.0.2 | HTTP via shared `@/shared/api/client`; `isHTTPError` for 409 mapping | Single client w/ refresh interceptor `[VERIFIED: api.ts, client.ts]` |
| `react-i18next` | 17.0.10 | FR/EN copy under `contracts.*`, `wizard.*`, `ops.*` | Zero bare literals rule `[VERIFIED: i18n]` |
| `sonner` | 2.0.7 | Toast feedback on lifecycle mutations | Already vendored (`shared/ui/sonner.tsx`) |

### Supporting (shared UI primitives — already vendored)
| Primitive | Path | Use in Phase 4 |
|-----------|------|----------------|
| `Table`, `Card` | `shared/ui/table.tsx`, `card.tsx` | Responsive list (table md+, card stack below) — copy VehicleList/CustomerList shape |
| `Select` | `shared/ui/select.tsx` | Status filter, fuel-level picker, deposit method |
| `Field*`, `Input`, `RadioGroup`, `Button` | `shared/ui/*` | Wizard/lifecycle forms |
| `Badge` | `shared/ui/badge.tsx` | Contract status badge (build `ContractStatusBadge` like `StatusBadge`/`CustomerTypeBadge`) |
| `Skeleton`, `EmptyState` | `shared/ui/*` | Loading + empty states |
| `Sheet` | `shared/ui/sheet.tsx` | Optional container for inline customer-create in the wizard (or render inline) |
| `Sonner` (Toaster) | `shared/ui/sonner.tsx` | Mutation success/error toasts |

### Must be hand-authored (NOT installed, do NOT add a package)
| Need | Approach | Why not a package |
|------|----------|-------------------|
| Wizard **stepper / progress indicator** | Hand-author a small `<WizardProgress steps activeIndex />` (flex row of numbered dots + labels + `aria-current`) | No stepper primitive exists; a 4-step indicator is ~30 lines. Adding a stepper lib violates the "no new deps" grain |
| **Date+time input** | Native `<input type="datetime-local">` + a `toRFC3339Algiers()` helper (see Code Examples) | `react-day-picker` is **not installed**; the backend wants full RFC3339 timestamptz, not a date. Native datetime-local + fixed `+01:00` offset is sufficient and dependency-free |
| **Dialog** | Not needed. Use `Sheet` if a modal is wanted; otherwise inline | No `dialog.tsx` vendored; wizard is a full route, not a modal |

**Installation:** none.

**Version verification:** All versions above read from `package.json` on 2026-07-28. No registry lookups performed because **no packages are added** — the phase is pure composition over the existing stack.

## Package Legitimacy Audit

> Not applicable — this phase installs **zero** external packages. All work reuses already-installed, already-audited dependencies. No SLOP/SUS surface introduced.

---

## API Contract (verbatim from Go source)

All routes are under the `/v1` prefix (ky `prefixUrl`) and inside the JWT-authed group (`authed`). Base URL default `http://localhost:8080/v1` `[VERIFIED: handlers.ts:29]`.

### Route table `[VERIFIED: server.go:129-143]`

| # | Op | Method | Path (under `/v1`) | Handler | Success | Authz |
|---|----|--------|--------------------|---------|---------|-------|
| 1 | Create reservation | POST | `/vehicles/:vehicleID/rental-contracts` | `CreateContract` | **201** | `CanOperate(vehicle.agency)` |
| 2 | List by vehicle | GET | `/vehicles/:vehicleID/rental-contracts?status=` | `ListContractsByVehicle` | 200 `[]` | `CanRead(vehicle.agency)` |
| 3 | Get one | GET | `/rental-contracts/:contractID` | `GetContract` | 200 | `CanRead` |
| 4 | Activate | POST | `/rental-contracts/:contractID/activate` | `Activate` | 200 | `CanOperate` |
| 5 | Close | POST | `/rental-contracts/:contractID/close` | `Close` | 200 | `CanOperate` |
| 6 | Cancel | POST | `/rental-contracts/:contractID/cancel` | `Cancel` | 200 | `CanOperate` |
| 7 | Record deposit | POST | `/rental-contracts/:contractID/deposit` | `RecordDeposit` | 200 | `CanOperate` |
| 8 | Return deposit | POST | `/rental-contracts/:contractID/deposit-return` | `ReturnDeposit` | 200 | `CanOperate` |
| 9 | Available vehicles | GET | `/vehicles/available?from=&to=` | `Available` | 200 `[]` | `CanRead` |
| 10 | (Phase 5) inspections | POST | `/rental-contracts/:contractID/inspections` | — | 201 | — |
| 11 | (Phase 6) invoices | GET | `/rental-contracts/:contractID/invoices` | — | 200 | — |

> **There is no `GET /rental-contracts` (list all) and no `/today` / `/dashboard` / `/agenda` route.** Confirmed exhaustively over `server.go:129-143`.

### Create request `[VERIFIED: rental_dto.go:22-26]`

```
POST /v1/vehicles/:vehicleID/rental-contracts    → 201 contractResponse (status="reserved")
```
| JSON field | Type | Rules |
|------------|------|-------|
| `customer_id` | string(uuid) | required |
| `starts_at` | string RFC3339 | required, `datetime=2006-01-02T15:04:05Z07:00` |
| `ends_at` | string RFC3339 | required; **must be strictly after `starts_at`** else 400 "ends_at must be after starts_at" `[VERIFIED: contract.go:105]` |

No `deposit`, no `agency_id` in the create body — the contract is **always born `reserved`** (`NewContract` hardcodes status) `[VERIFIED: contract.go:102-116]`. Agency is derived server-side from the vehicle.

### Activate request `[VERIFIED: rental_dto.go:29-33]`

```
POST /v1/rental-contracts/:contractID/activate   → 200 contractResponse (status="active")
```
| JSON field | Type | Rules |
|------------|------|-------|
| `actual_at` | string RFC3339 | **optional** (`omitempty`); server defaults to `now()` `[VERIFIED: service.go:145-148]` |
| `mileage` | int | `gte=0` (0 is valid → always send the key) |
| `fuel` | string | **required**, `oneof=empty quarter half three_quarters full` |

**Side effects in the same tx** `[VERIFIED: service.go:158-170]`: contract → `active`; **vehicle status → `rented`**; a `source=rental` mileage log is recorded. **Activate does NOT require any inspection data** — this is the Phase 4↔5 seam (see below).

### Close request `[VERIFIED: rental_dto.go:38-51]`

```
POST /v1/rental-contracts/:contractID/close      → 200 contractResponse (status="closed")
```
| JSON field | Type | Rules |
|------------|------|-------|
| `actual_at` | string RFC3339 | optional |
| `mileage` | int | `gte=0` |
| `fuel` | string | required, same `oneof` |
| `invoice_lines` | array | **required, `min=1`**, each element validated (`dive`) |

Each `invoice_lines[]` element:
| JSON field | Type | Rules |
|------------|------|-------|
| `description` | string | required |
| `quantity` | int | `gt=0` |
| `unit_price_ht_cents` | int64 | `gte=0` — **HT = hors taxe (pre-VAT), in cents** |
| `vat_rate` | int | `gte=0` — integer percent (e.g. `19` = 19%) |

**Side effects in the same tx** `[VERIFIED: service.go:197-221]`: contract → `closed`; **vehicle status → `available`**; mileage log; **invoice is issued server-side** (`invoicer.IssueForClosedContract`). Phase 4 only supplies the lines; Phase 6 owns the invoice document (D-08 boundary confirmed).

### Cancel request `[VERIFIED: rental_dto.go:55-57]`

```
POST /v1/rental-contracts/:contractID/cancel     → 200 contractResponse (status="cancelled")
```
| JSON field | Type | Rules |
|------------|------|-------|
| `reason` | string | **required**, trimmed & non-empty server-side `[VERIFIED: contract.go:176-180]` |

Side effect: if the contract was `active`, vehicle returns to `available` `[VERIFIED: service.go:254-257]`. `cancel_reason` + `cancelled_at` are recorded on the contract.

### Deposit requests (available; used by D-03 detail card, NOT by create) `[VERIFIED: rental_dto.go:60-70]`

- `POST /deposit` `{ amount_cents:int64 gte=0, method:oneof cash card transfer }` → 200
- `POST /deposit-return` `{ amount_cents:int64 gte=0, at?:RFC3339, note?:string }` → 200

### Response DTO — `contractResponse` `[VERIFIED: rental_dto.go:83-105]`

`src/types/rental.ts` already mirrors this **completely and correctly** — verified field-by-field, no drift. Key facts the planner must internalize:

- **Only `vehicle_id` + `customer_id` (UUIDs).** No `customer_name`, no `registration_plate`, **no `agency_id`.**
- `status` ∈ `reserved|active|closed|cancelled`.
- `starts_at`/`ends_at` are RFC3339 timestamptz (full timestamps, not dates).
- Departure fields (`actual_departure_at`, `departure_mileage`, `departure_fuel_level`) present only after activate; return fields only after close (all `omitempty`).
- `cancel_reason`/`cancelled_at` only after cancel.
- Deposit fields (`deposit_amount_cents`, `deposit_method`, `deposit_returned_*`, `deposit_note`) all `omitempty`.

**New DTO types to add to `src/types/rental.ts`** (mirror the request structs verbatim): `CreateContractBody`, `ActivateBody`, `CloseBody`, `CloseInvoiceLine`, `CancelBody`, `DepositBody`. Keep the "read-only mirror of Go" doc discipline already in that file.

## Status-Transition Matrix `[VERIFIED: contract.go:27-30, 128-190]`

| From \ Action | activate | close | cancel |
|---------------|----------|-------|--------|
| **reserved** | → active ✅ | ❌ 409 | → cancelled ✅ |
| **active** | ❌ 409 | → closed ✅ | → cancelled ✅ |
| **closed** | ❌ 409 (terminal) | ❌ 409 | ❌ 409 |
| **cancelled** | ❌ 409 (terminal) | ❌ 409 | ❌ 409 |

An illegal transition returns `domain.ErrConflict` → **HTTP 409** (`contract.go:130`). **UI button gating (D-03):** show *Activate* only when `status==="reserved"`; *Close* only when `status==="active"`; *Cancel* when `status ∈ {reserved, active}`. This mirrors the domain map exactly.

## Overlap Error Shape (RENT-01 core) `[VERIFIED: service.go:95-102, problem.go:47-48, rental_integration_test.go:55]`

Overlap is caught **twice**: an application pre-check (`checkCalendarOverlap` → `HasOverlap`) returns `domain.E(ErrConflict, "period overlaps an existing contract or unavailability on this vehicle")`; concurrently, the Postgres `EXCLUDE` constraint (SQLSTATE `23P01`) is the final guarantee. Both map to **HTTP 409**.

Wire shape (`application/problem+json`, RFC 7807 `[VERIFIED: problem.go:14-21, 71-82]`):
```json
{
  "type": "about:blank",
  "title": "Conflict",
  "status": 409,
  "detail": "period overlaps an existing contract or unavailability on this vehicle",
  "instance": "/v1/vehicles/<uuid>/rental-contracts"
}
```

**Friendly-message mapping (D-04):** In the create mutation's error handler, `isHTTPError(err) && err.response.status === 409` on the **create** call ⇒ render `t("contracts.errors.overlap")` = FR "Ce véhicule est déjà réservé sur cette période." / EN "This vehicle is already booked for this period." Never surface the raw detail or status.

⚠️ **409 is ambiguous across mutations.** On **create** ⇒ overlap. On **activate/close/cancel** ⇒ illegal status transition (stale UI, someone else already advanced the contract). Map per-mutation, not per-status-code:
- activate 409 → `t("contracts.errors.notReservable")`
- close 409 → `t("contracts.errors.notClosable")`
- cancel 409 → `t("contracts.errors.notCancellable")`

On any of these, **refetch the contract** (`invalidate ["contracts","detail",id]`) so the UI re-gates its buttons to the true current status.

## Authorization (D-09 — confirmed AGENCY-scoped) `[VERIFIED: service.go:54-84, permissions.ts]`

`snapshotAuthorized` resolves the vehicle, then gates on the **vehicle's agency**:
- **create / activate / close / cancel / deposit** → `CanOperate(vehicle.AgencyID)` (agent+).
- **get / list** → `CanRead(vehicle.AgencyID)` (viewer+).
- unavailability declare → `CanManage` (manager+, out of Phase 4 scope).

**Frontend gate: use `canOperate(scope, agencyId)` — NOT `hasOrgRole`.** Contracts are agency-scoped via the vehicle, unlike customers (which are org-scoped and use `hasOrgRole`). But `contractResponse` has **no `agency_id`**, so:
- **Detail action gating:** the detail screen already fetches the vehicle (for the plate) → use `vehicle.agency_id` with `canOperate`.
- **Wizard vehicle picker:** each vehicle carries `agency_id` → only offer vehicles where `canOperate(scope, v.agency_id)`.
- **`/contrats` "New contract" CTA:** before any vehicle is chosen there is no agency yet. Gate the CTA on `hasOrgRole(scope, "agent")` (can operate in *some* agency), then narrow inside the wizard per-vehicle. This mirrors the CustomerList CTA idiom `[VERIFIED: CustomerList.tsx:62]`. This gate is UX-only; the backend re-enforces with its own 403.

---

## Wizard Architecture (RENT-05 — the centerpiece)

### Recommendation: single React Hook Form + local step index. NO Zustand, NO XState.

**Decision (resolves D-05a):**

| Option | Verdict | Reasoning |
|--------|---------|-----------|
| **Single RHF `useForm` holding all steps, `useState` step index** | ✅ **RECOMMEND** | RHF keeps all field values in one in-memory store → back/next never loses data. Per-step validation via `trigger([...fields])`. Fresh form on each mount → satisfies "no persistence across reload" (D-05a). Reuses the exact `react-hook-form + zodResolver` pattern already shipped in `CustomerCreateForm.tsx`. Zero new deps. |
| Dedicated Zustand wizard store | ❌ Reject | Adds a second source of truth alongside RHF. Justified only if steps live on **separate routes** (they don't — D-05 mandates ONE route). Zustand is already in the app for *auth/session*, not form state. |
| XState machine | ❌ Reject | Not installed; overkill for a linear 4-step flow with two branches. |

**Why RHF survives navigation without data loss:** all steps render inside one `<FormProvider>`; stepping is just changing which section is visible. Even if a step unmounts, RHF retains values unless `shouldUnregister` is set (leave it default `false`). No manual state plumbing.

### State model

```typescript
// features/contracts/wizard/schema.ts
const wizardSchema = z.object({
  // Step 1 — vehicle
  vehicle_id: z.string().uuid(),
  // Step 2 — customer (existing OR just-created; the id is what matters)
  customer_id: z.string().uuid(),
  // Step 3 — terms (datetime-local strings, converted to RFC3339 on submit)
  starts_at_local: z.string().min(1),
  ends_at_local: z.string().min(1),
  deposit_amount: z.string().optional(),          // DZD, optional
  deposit_method: z.enum(["cash","card","transfer"]).optional(),
  // Step 4 — departure (what activate needs; the Phase 5 seam stops here)
  activate_now: z.boolean().default(true),
  departure_mileage: z.coerce.number().int().gte(0),
  departure_fuel: z.enum(["empty","quarter","half","three_quarters","full"]),
}).refine(v => v.ends_at_local > v.starts_at_local, {
  path: ["ends_at_local"], message: "contracts.errors.endBeforeStart",
});
```

### Step-by-step

| Step | What it does | Reuse |
|------|--------------|-------|
| **1. Vehicle** | Pick an available vehicle. Render `useVehiclesQuery("available")` filtered to agencies where `canOperate`. Selecting sets `vehicle_id`. | `features/fleet/queries.ts` + VehicleList table/card shape |
| **2. Customer** | Toggle: *pick existing* (debounced `useCustomersQuery(q)` search list, like CustomerList) **or** *create new* inline (`useCreateCustomerMutation`, returns `customer.id` → set into form). | `features/customers` queries + mutations + CustomerCreateForm |
| **3. Terms** | `datetime-local` for start/end (→ RFC3339 on submit). Optional deposit amount+method. Validate `ends > starts` client-side. | native inputs + `Field*` |
| **4. Departure** | `departure_mileage` + `departure_fuel` (5-level Select). Optional `activate_now` toggle. **This is the seam — no photos/zones here.** | `Field*`, `Select` |

`trigger()` gates advance: `await trigger(["vehicle_id"])` before leaving step 1, etc. A `<WizardProgress>` shows the 4 dots with `aria-current="step"`.

### Finish sequence — multi-call create-then-activate (reuse the customers partial-failure lesson)

The finish is **not one call**. It's a sequence, exactly the failure-discipline shape of `customers/mutations.ts` (create-then-attach). `[VERIFIED: mutations.ts:110-132]`

```
1) POST create {customer_id, starts_at, ends_at}   → 201 reserved contract
     └─ 409 ⇒ overlap: stay on wizard (step 1/3), show contracts.errors.overlap. Nothing persisted.
2) IF deposit entered: POST /deposit {amount_cents, method}   → 200   (optional)
3) IF activate_now: POST /activate {mileage, fuel}  → 200 active
```

**Partial-failure invariant (mirror the customer create-then-attach):** once step 1 returns 201, the contract is **persisted and never rolled back** (no transactional multi-endpoint exists). If step 3 (activate) then fails, do **not** re-create on retry — navigate to `/contrats/$contractId` (the reserved contract) and surface "réservation créée; activez le départ manuellement", with the activate action available on the detail page. This is the same discipline as `CustomerCreateForm`'s partial-failure guard `[VERIFIED: CustomerCreateForm.tsx:158-210]`.

### The Phase 4 ↔ Phase 5 departure-inspection seam (DEFINITION)

**Confirmed by source:** the rental **activate** endpoint requires only `mileage` + `fuel` + optional `actual_at` `[VERIFIED: rental_dto.go:29-33]`. The full état des lieux (photos, per-zone damage) is a **separate** endpoint `POST /rental-contracts/:contractID/inspections` `[VERIFIED: server.go:142]` owned by Phase 5.

| Concern | Phase 4 (this phase) | Phase 5 |
|---------|----------------------|---------|
| Departure mileage + fuel | ✅ captured in wizard step 4, sent to `activate` | — |
| Vehicle → `rented`, mileage log | ✅ server side-effect of activate | — |
| Photos, per-zone damage, offline-resilient capture | ❌ out of scope | ✅ `POST /inspections` |
| Wizard step 4 UI | A minimal mileage+fuel form + a stub/handoff note ("l'état des lieux photo détaillé sera disponible à l'étape suivante") | Replaces the stub with the real EDL capture |

**Seam contract for the plan:** wizard step 4 collects only what `activate` accepts; it must NOT try to POST inspection data. Leave a clearly-labelled extension point (e.g. a placeholder card `data-phase="5-inspection-handoff"`) so Phase 5 slots the EDL in without reworking the wizard skeleton.

---

## OPS-01 Today Overview (composition + timezone)

**Data source: composed client-side. No endpoint exists** (confirmed). Strategy:

```
1. vehicles = useVehiclesQuery(null)                    // agency-scoped list (already shipped)
2. For each vehicle, fetch its relevant contracts:
     - returns:  status=active  → GET /vehicles/:id/rental-contracts?status=active
     - pickups:  status=reserved → GET /vehicles/:id/rental-contracts?status=reserved
   (fleet already has fetchActiveContract(vehicleId) — generalize it)   [VERIFIED: fleet/api.ts:35-45]
3. pickups today = reserved contracts whose starts_at, in Africa/Algiers, is today
   returns today = active   contracts whose ends_at,   in Africa/Algiers, is today
4. Join customer_id → customer name (batch useCustomersQuery("") or per-id) and vehicle_id → plate.
```

This is an **N+1 fan-out** (one contracts request per vehicle). Acceptable at the single-agency SME fleet scale this product targets, but must be implemented with `useQueries` (parallel) and a combined loading/error state. Consider fetching only `status=reserved` and `status=rented`-vehicle contracts to bound the fan-out.

**Timezone (Algeria = UTC+1, no DST):** `starts_at`/`ends_at` are RFC3339 timestamptz. "Today" must be computed in **Africa/Algiers**, not UTC. A naïve `new Date(ts).toISOString().slice(0,10) === new Date().toISOString().slice(0,10)` is **wrong near midnight** (UTC is one hour behind local). Use:

```typescript
const ALGIERS = "Africa/Algiers";
const dayKey = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: ALGIERS, year:"numeric", month:"2-digit", day:"2-digit" })
    .format(new Date(iso));            // "YYYY-MM-DD" in Algiers local time
const isToday = (iso: string) => dayKey(iso) === dayKey(new Date().toISOString());
```

**Landing route:** `/` (currently `EmptyState`) becomes the dashboard (`OpsToday` screen). Two sections: "Départs du jour" (pickups) and "Retours du jour" (returns), each a compact list linking to `/contrats/$contractId`. Empty → friendly "Rien de prévu aujourd'hui."

---

## Architecture Patterns

### System Architecture Diagram

```
                         ┌──────────────────────────── /contrats/nouveau (RENT-05) ───────────────┐
                         │  ONE React Hook Form  +  useState(stepIndex)  +  <WizardProgress/>       │
 user ── nav ──▶         │  step1 Vehicle → step2 Customer → step3 Terms → step4 Departure         │
                         │        │              │              │              │                    │
                         │  useVehiclesQuery  useCustomersQuery  datetime-local  mileage+fuel        │
                         │  (available)       + inline create   → RFC3339        (Phase5 seam)       │
                         └──────────────────────────── finish() ─────────────────────────────────┘
                                    │ 1.POST create (201 reserved)     ── 409 ⇒ overlap toast
                                    │ 2.POST /deposit (optional)
                                    │ 3.POST /activate (200 active)    ── partial-failure → detail
                                    ▼
        ┌───────────────── shared ky client (/v1, refresh interceptor) ──────────────────┐
        │  wheelio-api  rental module                                                     │
        │   create/activate/close/cancel  ──▶  domain state machine + EXCLUDE constraint  │
        └────────────────────────────────────────────────────────────────────────────────┘
                                    ▲
    /contrats (list) ──┐           │  NO list-all endpoint → compose:
    / (OPS-01 today) ──┴──▶  useQueries: vehicles ✕ GET /vehicles/:id/rental-contracts?status=…
                                       + join customer/vehicle names + Africa/Algiers date filter
    /contrats/$contractId (detail) ──▶ GET /rental-contracts/:id  + GET vehicle (plate, agency gate)
                                       + status-gated actions: activate | close | cancel
```

### Recommended project structure

```
src/features/contracts/
├── api.ts                 # thin ky calls: createContract, activateContract, closeContract,
│                          #   cancelContract, getContract, listContractsByVehicle, recordDeposit
├── queries.ts             # useContractQuery(id), useContractsByVehicleQuery(vehicleId, status),
│                          #   useTodayOverviewQuery() (useQueries fan-out), useAllContractsQuery()
├── mutations.ts           # useCreateContract, useActivate, useClose, useCancel, useRecordDeposit
│                          #   (+ finishWizard sequence w/ partial-failure handling)
├── ContractStatusBadge.tsx
├── ContractList.tsx       # /contrats — composed list (table md+ / cards below)
├── ContractDetail.tsx     # /contrats/$contractId — card + gated action buttons
├── OpsToday.tsx           # / — pickups + returns today
├── forms/                 # ActivateForm, CloseForm (invoice lines useFieldArray), CancelDialog
└── wizard/
    ├── ContractWizard.tsx     # FormProvider + step index + WizardProgress + finish sequence
    ├── WizardProgress.tsx     # hand-authored stepper
    ├── StepVehicle.tsx  StepCustomer.tsx  StepTerms.tsx  StepDeparture.tsx
    └── schema.ts              # zod wizard schema
```

### Route changes

`/contrats` is currently a **flat placeholder file** `src/routes/_authenticated/contrats.tsx` `[VERIFIED]`. Convert to a **directory route** mirroring `clients/`:
- `contrats/index.tsx` → `ContractList`
- `contrats/nouveau.tsx` → `ContractWizard`
- `contrats/$contractId.tsx` → `ContractDetail`
- `_authenticated/index.tsx` → `OpsToday` (replaces `EmptyState`)

Route files own no loaders — component-level `useQuery` is the established idiom `[VERIFIED: clients/index.tsx]`.

### Pattern 1: lifecycle mutation with dual-namespace invalidation (D-06)
**What:** every lifecycle mutation invalidates both contract and vehicle caches (status side-effects).
```typescript
// Source: mirrors customers/mutations.ts:126-131 invalidation idiom
export function useActivate(contractId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ActivateBody) => activateContract(contractId, body),
    onSuccess: (contract) => {
      qc.invalidateQueries({ queryKey: ["contracts"] });            // detail, byVehicle, today, list
      qc.invalidateQueries({ queryKey: ["vehicles"] });             // vehicle → rented
    },
  });
}
```

### Pattern 2: RFC3339 timestamp construction from a datetime-local input
```typescript
// datetime-local gives wall-clock "YYYY-MM-DDTHH:mm" with NO zone.
// Algeria is a fixed +01:00 (no DST) → append seconds + offset to make valid RFC3339.
export function toRFC3339Algiers(local: string): string {
  // local === "2026-07-28T09:30"
  return `${local}:00+01:00`;          // → "2026-07-28T09:30:00+01:00" (accepted by datetime= validator)
}
```

### Anti-Patterns to Avoid
- **Inventing a `GET /contracts` list** — it does not exist. Compose from vehicles.
- **Reading `agency_id` off `contractResponse`** — it isn't there; get it from the vehicle.
- **Gating contract actions with `hasOrgRole`** — that's the org axis (customers). Contracts are per-agency `canOperate`.
- **Treating vehicle `status==="available"` as a booking guarantee** — a vehicle available *now* can be booked for a future window. The create **409 is the authority.**
- **UTC "today" math** — off-by-one near midnight; use Africa/Algiers.
- **Re-POSTing create on activate-retry** — partial-failure invariant; the reserved contract already exists.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Overlap detection | Client-side calendar conflict logic | The backend `EXCLUDE` + 409 | The DB is the single source of truth; any client check races and drifts |
| Multi-step form state | Custom context/reducer for step data | One `react-hook-form` + `trigger()` | Already the codebase idiom; survives nav for free |
| Wizard step validation | Manual per-field checks | zod schema + `trigger([...])` | Reuses `zodResolver` already shipped |
| HTTP error typing | `err.status` guesswork | `isHTTPError(err)` from ky | Established; typed `response.status` `[VERIFIED: client.ts:39]` |
| Toast feedback | Custom notification | `sonner` (`shared/ui/sonner.tsx`) | Already vendored |
| Date picker | Add `react-day-picker` | Native `datetime-local` + offset helper | Backend wants timestamptz; no dep needed |

**Key insight:** the entire phase is composition over an already-complete backend. The only genuinely new UI construct is the wizard shell (stepper + step orchestration); everything else is a re-application of the fleet/customers list/detail/mutation patterns.

## Runtime State Inventory

> Not a rename/refactor/migration phase — greenfield feature composition. Section omitted per instructions. (One migration-adjacent item is tracked below under Pitfall 7 / E2E: the placeholder-route test inventory must be updated.)

## Common Pitfalls

### Pitfall 1: Treating "available" vehicles as bookable for any period
**What goes wrong:** wizard step 1 filters to `status==="available"`, user picks one, sets future dates that collide with an existing reservation, gets a 409 they didn't expect.
**Why:** `vehicle.status` is a *current* axis; bookings are a *calendar* axis. `GET /vehicles/available?from=&to=` is the only period-aware availability, but it needs dates first (contradicts vehicle-first order).
**How to avoid:** keep vehicle-first UX with the plain available list, and treat the create **409 as the authoritative overlap signal** with the friendly message. Optionally, after dates are entered (step 3), re-validate by calling `/vehicles/available` — but the 409 remains the guarantee.
**Warning signs:** users confused by "available" vehicle rejected at finish → ensure the overlap message names the period.

### Pitfall 2: 409 ambiguity (overlap vs illegal transition)
**What goes wrong:** a generic "conflict" toast on activate/close/cancel misreads a stale-UI transition error as an overlap.
**How to avoid:** map 409 per-mutation (see Overlap Error Shape) and refetch the contract to re-gate buttons.

### Pitfall 3: UTC date math for OPS-01
**What goes wrong:** a pickup at 00:30 Algiers time shows under yesterday/tomorrow.
**How to avoid:** `Intl.DateTimeFormat(timeZone:"Africa/Algiers")` day-key comparison.

### Pitfall 4: Wizard data loss / accidental re-create
**What goes wrong:** stepping back clears fields, or an activate failure re-runs create.
**How to avoid:** one RHF form (default `shouldUnregister:false`); guard finish so once create returns 201, retry never re-POSTs create (partial-failure invariant from `CustomerCreateForm`).

### Pitfall 5: Incomplete close payload
**What goes wrong:** close with zero invoice lines → 400 (`min=1`), or `unit_price_ht_cents` sent as DZD not cents.
**How to avoid:** `useFieldArray` for lines with a required first row; convert DZD → cents (`*100`); `vat_rate` is an integer percent.

### Pitfall 6: MSW path-vs-query matching
**What goes wrong:** MSW v2 matches **paths only**, never query strings.
**How to avoid:** parse `request.url` searchParams inside handlers (the existing handlers already do this `[VERIFIED: handlers.ts:98-99]`).

### Pitfall 7: E2E/placeholder regression when `/` and `/contrats` go live
**What goes wrong:** `placeholders.test.tsx` asserts `/` and `/contrats` render `EmptyState`; `e2e/auth.spec.ts` asserts the `/` landing shows "Bientôt disponible" (line 150-151). Making them real screens breaks both.
**How to avoid:** (a) remove `"/"` and `"/contrats"` from `allPlaceholderRoutes` in `placeholders.test.tsx:33-40` (the remaining placeholder used for positive assertions is `/etats-des-lieux`, already the file's primary target); (b) in `e2e/auth.spec.ts`, replace the `/`-landing empty-state assertions with OPS-today dashboard assertions, and add mocked responses for `GET /vehicles/:id/rental-contracts` so the composed dashboard doesn't 404 into the error banner (`mockApi` currently only mocks `/vehicles` and `/customers`, returning `[]`). Keep `/etats-des-lieux` as the language-switch/placeholder target — it stays a placeholder until Phase 5.

## Code Examples

### Contracts api.ts (thin ky calls, mirror fleet/customers)
```typescript
// Source: pattern from src/features/fleet/api.ts + customers/api.ts
import { api } from "@/shared/api/client";
import type { ContractResponse } from "@/types/rental";
import type { CreateContractBody, ActivateBody, CloseBody, CancelBody } from "@/types/rental";

export function createContract(vehicleId: string, body: CreateContractBody) {
  return api.post(`vehicles/${encodeURIComponent(vehicleId)}/rental-contracts`, { json: body })
    .json<ContractResponse>();
}
export function activateContract(contractId: string, body: ActivateBody) {
  return api.post(`rental-contracts/${encodeURIComponent(contractId)}/activate`, { json: body })
    .json<ContractResponse>();
}
export function closeContract(contractId: string, body: CloseBody) {
  return api.post(`rental-contracts/${encodeURIComponent(contractId)}/close`, { json: body })
    .json<ContractResponse>();
}
export function cancelContract(contractId: string, body: CancelBody) {
  return api.post(`rental-contracts/${encodeURIComponent(contractId)}/cancel`, { json: body })
    .json<ContractResponse>();
}
export function getContract(contractId: string) {
  return api.get(`rental-contracts/${encodeURIComponent(contractId)}`).json<ContractResponse>();
}
export function listContractsByVehicle(vehicleId: string, status?: string) {
  const sp = new URLSearchParams();
  if (status) sp.set("status", status);
  return api.get(`vehicles/${encodeURIComponent(vehicleId)}/rental-contracts`, { searchParams: sp })
    .json<ContractResponse[]>();
}
```

### OPS-01 fan-out with useQueries
```typescript
// Source: TanStack Query useQueries — parallel per-vehicle fetch, combined
import { useQueries } from "@tanstack/react-query";
export function useContractsForVehicles(vehicleIds: string[], status: "reserved" | "active") {
  return useQueries({
    queries: vehicleIds.map((id) => ({
      queryKey: ["contracts", "byVehicle", id, { status }],
      queryFn: () => listContractsByVehicle(id, status),
    })),
    combine: (results) => ({
      data: results.flatMap((r) => r.data ?? []),
      isPending: results.some((r) => r.isPending),
      isError: results.some((r) => r.isError),
    }),
  });
}
```

### Overlap-aware create mutation
```typescript
import { isHTTPError } from "ky";
export function useCreateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ vehicleId, body }: { vehicleId: string; body: CreateContractBody }) =>
      createContract(vehicleId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });
}
// In the wizard finish handler:
try { const c = await createMut.mutateAsync({ vehicleId, body }); /* …activate… */ }
catch (e) {
  if (isHTTPError(e) && e.response.status === 409) setOverlapError(t("contracts.errors.overlap"));
  else setError(t("contracts.errors.createFailed"));
}
```

## State of the Art

| Old Approach | Current Approach | When | Impact |
|--------------|------------------|------|--------|
| Multi-route wizards with global store | Single-route RHF wizard + `trigger()` | RHF 7.x | No cross-route state plumbing; data survives nav natively |
| `react-day-picker` for any date | Native `datetime-local` when a timestamp (not a rich calendar) is needed | — | Zero dep for this phase's needs |
| Manual fetch waterfalls for N+1 | `useQueries` + `combine` | TanStack Query v5 | Parallel fan-out, one combined state |

**Deprecated/outdated:** none relevant.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vehicle picker uses the plain vehicles list filtered to `status==="available"` rather than `GET /vehicles/available` | Wizard Step 1 / Pitfall 1 | Low — the create 409 is the real guard; picker choice is UX. Planner may prefer dates-first + `/vehicles/available`. `[ASSUMED]` |
| A2 | Deposit is captured optionally in the wizard and sent via a **separate** `POST /deposit` after create (create body has no deposit field) | Wizard finish sequence | Low — verified the create DTO lacks deposit `[VERIFIED: rental_dto.go:22-26]`; the "separate call" wiring is the assumption. Alternative: defer deposit to the detail page entirely. `[ASSUMED]` |
| A3 | OPS-01 N+1 fan-out is acceptable at target fleet scale | OPS-01 | Medium — if a tenant has hundreds of vehicles, consider bounding to `status=rented` vehicles + reserved contracts only. `[ASSUMED]` |
| A4 | `activate_now` (reserve-only vs reserve+depart) is offered in step 4 | Wizard Step 4 | Low — CONTEXT frames the wizard as one flow ending in departure; a reserve-only escape hatch is a UX nicety, not required. `[ASSUMED]` |

## Open Questions

1. **Deposit placement in the wizard (D-05 step 3 says "dates, deposit").**
   - What we know: the **create** endpoint has no deposit field; deposit is a separate `POST /deposit` `[VERIFIED]`.
   - What's unclear: whether to (a) capture deposit in the wizard and fire a second call, or (b) drop deposit from the wizard and only expose it on the detail page.
   - Recommendation: capture it optionally in step 3; on finish, if entered, `POST /deposit` after the 201 create (own it in the finish sequence with the same partial-failure grace). Detail page also exposes record/return deposit.

2. **Vehicle-first vs dates-first ordering (availability).**
   - What we know: `/vehicles/available` needs `from`/`to`; a period-agnostic vehicle list can't guarantee a future window.
   - What's unclear: whether the discuss/plan wants strict availability up front.
   - Recommendation: keep vehicle-first for UX continuity; rely on the create 409. Revisit if users hit frequent late-stage overlap rejections.

3. **Batch name resolution for list/today.**
   - What we know: contracts carry only UUIDs; `useCustomersQuery("")` returns the full org customer list, `useVehiclesQuery(null)` the vehicle list.
   - Recommendation: fetch both lists once and join in-memory (Map by id) rather than per-row detail fetches.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node + Vite dev/test toolchain | build, test | ✓ | vite 8.1.5 | — |
| wheelio-api rental endpoints | runtime | ✓ (implemented, read from source) | — | MSW mocks for all tests |
| `@tanstack/react-query`, `react-hook-form`, `ky`, `sonner`, `zod` | all features | ✓ | see Standard Stack | — |
| MSW | vitest/RTL | ✓ | 2.15.0 | — |
| Playwright | E2E | ✓ | 1.61.1 | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — no new packages.

## Validation Architecture

> `workflow.nyquist_validation` not disabled → section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 + @testing-library/react 16.3.2 + MSW 2.15.0 (unit/integration); Playwright 1.61.1 (E2E) |
| Config file | `vite.config.ts` (test block), `src/test/mocks/server.ts`, `playwright.config.ts` |
| Quick run command | `npx vitest run src/features/contracts` |
| Full suite command | `npx vitest run && npx playwright test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RENT-01 | Create reservation succeeds (201 → reserved) | integration | `npx vitest run src/features/contracts/mutations.test.tsx` | ❌ Wave 0 |
| RENT-01 | Overlap → 409 → friendly message, no double-book | integration | `npx vitest run src/features/contracts/wizard` | ❌ Wave 0 |
| RENT-02 | Activate reserved → active, mileage+fuel sent | integration | `npx vitest run src/features/contracts/mutations.test.tsx` | ❌ Wave 0 |
| RENT-02 | Activate on non-reserved → 409 → notReservable + refetch | integration | same | ❌ Wave 0 |
| RENT-03 | Close active → closed with ≥1 invoice line; DZD→cents; vat_rate int | integration | `npx vitest run src/features/contracts/forms` | ❌ Wave 0 |
| RENT-04 | Cancel reserved/active with required reason recorded | integration | `npx vitest run src/features/contracts` | ❌ Wave 0 |
| RENT-05 | Wizard step nav preserves data; per-step validation gates advance | component | `npx vitest run src/features/contracts/wizard` | ❌ Wave 0 |
| RENT-05 | Finish sequence create→activate; partial-failure (activate fails) → detail, no re-create | integration | same | ❌ Wave 0 |
| RENT-05 | Inline customer create sets customer_id | component | same | ❌ Wave 0 |
| OPS-01 | Pickups=reserved starting today, returns=active ending today (Algiers TZ) | unit + component | `npx vitest run src/features/contracts/OpsToday.test.tsx` | ❌ Wave 0 |
| OPS-01 | Midnight boundary: Algiers-local day, not UTC | unit | date-helper test | ❌ Wave 0 |
| D-03 | Detail action buttons gated by status + canOperate(vehicle.agency) | component | `npx vitest run src/features/contracts/ContractDetail.test.tsx` | ❌ Wave 0 |
| D-02 | Composed list renders plate+customer+period+status; status filter | component | `npx vitest run src/features/contracts/ContractList.test.tsx` | ❌ Wave 0 |
| — | Full wizard happy path (login→reserve→activate) | E2E | `npx playwright test e2e/rental.spec.ts` | ❌ Wave 0 |
| — | Placeholder-route inventory updated (`/`, `/contrats` removed) | component | `npx vitest run src/routes/_authenticated/placeholders.test.tsx` | ✅ exists — migrate |
| — | E2E landing + nav still green after `/` goes live | E2E | `npx playwright test e2e/auth.spec.ts` | ✅ exists — migrate |

### MSW handlers to add (`src/test/mocks/handlers.ts`)
- `POST /vehicles/:vehicleID/rental-contracts` → 201 reserved contract; **variant** returning 409 `application/problem+json` (overlap) for the overlap scenario.
- `POST /rental-contracts/:contractID/activate` → 200 active (echo mileage/fuel/departure fields).
- `POST /rental-contracts/:contractID/close` → 200 closed; assert `invoice_lines.length >= 1` else 400.
- `POST /rental-contracts/:contractID/cancel` → 200 cancelled (require `reason`).
- `GET /rental-contracts/:contractID` → 200 (lookup in fixtures).
- `POST /rental-contracts/:contractID/deposit` → 200 (if deposit wired into wizard).
- (per-vehicle list already exists at `handlers.ts:130-151`.)

### Fixtures to add (`src/test/fixtures/`)
- Contracts in **each** status: reserved, active, closed, cancelled (currently only one `active` fixture exists `[VERIFIED: fleet.ts]`).
- An **overlap pair** (two contracts, same vehicle, overlapping windows) for the 409 scenario.
- A **reserved-today** contract (`starts_at` = today Algiers) and an **active-ending-today** contract (`ends_at` = today) for OPS-01.
- Ensure customer + vehicle fixtures exist to join names.

### Sampling Rate
- **Per task commit:** `npx vitest run src/features/contracts` (+ the touched route/test file)
- **Per wave merge:** `npx vitest run`
- **Phase gate:** `npx vitest run && npx playwright test` fully green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/features/contracts/{api,queries,mutations}.test.tsx` — RENT-01..04 lifecycle + invalidation
- [ ] `src/features/contracts/wizard/*.test.tsx` — RENT-05 step nav, validation, finish sequence, partial failure
- [ ] `src/features/contracts/OpsToday.test.tsx` + a date-helper unit test — OPS-01 + Algiers TZ
- [ ] `src/features/contracts/ContractList.test.tsx`, `ContractDetail.test.tsx` — D-02/D-03
- [ ] `e2e/rental.spec.ts` — full wizard happy path
- [ ] Migrate `placeholders.test.tsx` (drop `/`, `/contrats`) and `e2e/auth.spec.ts` (landing → OPS dashboard; mock per-vehicle contracts)
- [ ] Extend `handlers.ts` + fixtures as above
- [ ] i18n: add `contracts.{fuel,columns,actions,errors,deposit}.*`, `wizard.*`, `ops.*` in FR **and** EN (parity gate)

## Security Domain

> `security_enforcement` not disabled → section included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no (inherited) | JWT session already established Phase 1; refresh interceptor in shared client |
| V3 Session Management | no (inherited) | single-flight refresh `[VERIFIED: client.ts]` |
| V4 Access Control | **yes** | UX gate `canOperate(scope, vehicle.agency_id)`; backend re-enforces every mutation (403). Never trust the client gate |
| V5 Input Validation | **yes** | zod per-step + payload schemas; mirror backend `oneof`/`gte`/`min` rules; DZD→cents conversion validated |
| V6 Cryptography | no | none introduced |
| V11 Business Logic | **yes** | status-transition gating mirrors domain map; overlap enforced by DB; partial-failure invariant prevents duplicate contracts |

### Known Threat Patterns for React SPA + REST
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path-param injection in contract/vehicle ids | Tampering | `encodeURIComponent` each id in api.ts (established idiom `[VERIFIED: customers/api.ts]`) |
| Privilege escalation via client gate bypass | Elevation of Privilege | Client gate is UX only; backend `CanOperate`/RLS is the boundary `[VERIFIED: service.go:54-84]` |
| Double-booking / race | Tampering | DB `EXCLUDE` + app pre-check → 409; client never authorizes bookings |
| Stale-UI illegal transition | Tampering | 409 → refetch + re-gate |
| Leaking raw error detail to user | Information Disclosure | Map 409/5xx to friendly i18n copy; never render `problem.detail` verbatim |

## Sources

### Primary (HIGH confidence — read verbatim this session)
- `wheelio-api/internal/adapter/httpapi/server.go:129-143` — route table
- `wheelio-api/internal/adapter/httpapi/rental_handler.go` — handler behavior
- `wheelio-api/internal/adapter/httpapi/rental_dto.go` — request/response DTO fields + validation tags
- `wheelio-api/internal/domain/rental/contract.go:27-190` — status machine, activate/close/cancel invariants
- `wheelio-api/internal/usecase/rental/service.go:54-347` — authz, overlap pre-check, side effects, tx boundaries
- `wheelio-api/internal/adapter/httpapi/problem.go` — RFC 7807 error mapping (409/400/403)
- `wheelio-api/internal/adapter/postgres/rental_integration_test.go` — EXCLUDE constraint proof (23P01 → ErrConflict)
- `wheelio-front/src/types/rental.ts`, `features/fleet/{api,queries}.ts`, `features/customers/{api,queries,mutations}.ts`, `CustomerCreateForm.tsx`, `CustomerList.tsx`, `VehicleList.tsx`, `shared/auth/permissions.ts` — frontend patterns
- `wheelio-front/src/test/mocks/handlers.ts`, `routes/_authenticated/{contrats,index,placeholders.test}.tsx`, `e2e/auth.spec.ts` — test infra + placeholder migration surface
- `wheelio-front/package.json` — installed dependency inventory

### Secondary (MEDIUM confidence)
- TanStack Query v5 `useQueries`/`combine`; React Hook Form `trigger()` step-validation — standard documented APIs (training knowledge, widely stable).

### Tertiary (LOW confidence)
- none.

## Metadata

**Confidence breakdown:**
- API contract: HIGH — every field/route read from Go source with file:line.
- Overlap/transition semantics: HIGH — read from domain + service + integration test.
- Frontend patterns: HIGH — read from shipped Phase 2/3 code.
- Wizard architecture: MEDIUM-HIGH — recommendation follows the codebase grain; exact UX (deposit placement, vehicle/dates ordering) left as open questions for discuss/plan.
- OPS-01 scale/perf: MEDIUM — composition confirmed; fan-out cost is a scale assumption.

**Research date:** 2026-07-28
**Valid until:** 2026-08-27 (stable backend; re-verify only if `rental_*.go` changes)
</content>
</invoke>
