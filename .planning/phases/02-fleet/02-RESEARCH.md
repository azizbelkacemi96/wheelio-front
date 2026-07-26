# Phase 2: Fleet - Research

**Researched:** 2026-07-23
**Domain:** React SPA feature phase — vehicle list + detail against an existing Go REST API
**Confidence:** HIGH (every API claim verified by reading wheelio-api Go source directly; every frontend pattern verified in the Phase 1 codebase)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D-01 | Vehicle list = dense data table (desktop) degrading to stacked cards (<md), consistent with Phase 1's D-04 dense/compact choice | Counter staff scan many rows; mobile field use needs cards |
| D-02 | Live status displayed as colored Badge using existing design tokens (semantic colors), one color per backend status value — never invent client-side statuses | AUTH-03 principle: backend is the source of truth |
| D-03 | List columns: plate, brand/model, status, mileage, fuel level, agency (owner view). Filter: by status + text search on plate/brand/model. Client-side filtering acceptable if API has no query params; follow researcher's API findings | FLEET-01 scope, no invention |
| D-04 | Vehicle detail = dedicated route `/vehicules/$vehicleId` replacing the Phase 1 placeholder pattern; shows plate, brand/model, mileage, fuel, current status, current contract summary IF the API exposes it (researcher must confirm endpoint shape) | FLEET-02 |
| D-05 | Read-only phase: NO vehicle create/edit/delete UI in Phase 2 — the roadmap scopes only list + detail. Vehicle CRUD screens are out of scope (backend has them; UI defers) | Scope fence per ROADMAP |
| D-06 | Data fetching via TanStack Query with the shared `api` ky client; query keys namespaced `["vehicles", ...]`; agency scoping follows `currentAgencyId` from the auth store where the API is agency-scoped | Phase 1 architecture continuity |
| D-07 | All copy through i18n (FR default + EN), zero bare JSX literals — same Copywriting Contract as Phase 1 UI-SPEC | AUTH-05/AUTH-06 |
| D-08 | Role gating: list+detail visible to all roles (viewer and above) per backend Scope; no owner-only surface in this phase | Backend CanRead semantics |
| D-09 | Loading = skeleton rows; error = inline retry banner (same pattern as AppShell's); empty = EmptyState component from 01-07 | UI-state taxonomy, existing components |

### Claude's Discretion

(No explicit discretion section in 02-CONTEXT.md — D-03 delegates the server-vs-client filtering choice to this research's API findings; resolved below.)

### Deferred Ideas (OUT OF SCOPE)

- NO vehicle creation/edit forms (defer; backend supports, UI out of v1 phase 2 scope).
- NO mileage-log UI, NO document upload UI (out of scope table in REQUIREMENTS.md).
- NO availability calendar (FLEET-03 is v2).
- Placeholder route `/vehicules` from 01-07 gets replaced by the real list screen.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FLEET-01 | Vehicle list with live status (available, rented, maintenance, etc.) | `GET /v1/vehicles` contract confirmed with `?agency_id=` and `?status=` query params; exact status enum values verified in domain source; Badge/token mapping specified below |
| FLEET-02 | Vehicle detail: plate, brand/model, mileage, fuel level, current contract if one exists | `GET /v1/vehicles/:vehicleID` + `GET /v1/vehicles/:vehicleID/rental-contracts?status=active` composition documented; CRITICAL finding: the vehicle entity has NO fuel-level field — fuel level only exists on rental contracts (see "Fuel level reality" below) |
</phase_requirements>

## Summary

The backend contract is fully favorable to this phase: `GET /v1/vehicles` returns the whole org-scoped, non-archived fleet with optional `agency_id` and `status` query filters (no pagination — the endpoint returns everything in one array, ordered by brand/model/plate). `GET /v1/vehicles/:vehicleID` returns the same `vehicleResponse` shape. There is **no** "current contract" field on the vehicle response; the cheapest correct composition for FLEET-02 is a second query, `GET /v1/vehicles/:vehicleID/rental-contracts?status=active`, which the backend supports natively.

Two contract facts will surprise the planner if not stated up front. **(1) Vehicles have no fuel level.** `vehicleResponse` carries `fuel_type` (petrol/diesel/…), not a gauge reading. Fuel *level* (`empty|quarter|half|three_quarters|full`) exists only on rental contracts as `departure_fuel_level` / `return_fuel_level`. FLEET-02's "fuel level" can only be shown as the active contract's departure fuel level (or absent). **(2) The frontend currently has a `/v1` prefix drift**: every route in `server.go` is under `/v1`, but `.env.example` sets `VITE_API_URL=http://localhost:8080` and no frontend code adds `/v1`. Phase 1 shipped entirely against MSW mocks so this never surfaced; the first real-backend integration will 404 unless `VITE_API_URL` includes `/v1` (recommended fix: update `.env.example` to `http://localhost:8080/v1` — zero code change, MSW handlers already derive from the same variable).

No new npm packages are needed. The list should be a plain semantic table styled with existing tokens (shadcn's `table` registry component is dependency-free markup; the heavier `data-table` pattern needs `@tanstack/react-table` and is overkill for a client-side-searched list). All data fetching reuses the existing `api` ky client + TanStack Query pattern proven in `TopBar.tsx`.

**Primary recommendation:** Build `src/features/fleet/` mirroring `src/features/auth/`; fetch `GET vehicles?agency_id={currentAgencyId ?? omitted}` with server-side `?status=` filtering + client-side text search; detail page composes vehicle + active-contract queries; fix the `/v1` base-URL drift as the phase's first task.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Vehicle list data, agency scoping, archived exclusion | API / Backend (existing) | — | `ListVehicles` service filters by org + memberships server-side (`service.go:144-167`); RLS second barrier |
| Status filter | API / Backend (`?status=`) | Browser (query-key refetch) | Endpoint validates and applies the filter in SQL (`vehicle_handler.go:59-65`) |
| Text search on plate/brand/model | Browser / Client | — | API has no text-search param; list is unpaginated so client-side filter over the fetched array is correct and cheapest |
| Current-contract resolution | Browser composition of two API calls | API (`?status=active`) | No joined endpoint exists; `ListContractsByVehicle` with status filter is the backend-supported primitive |
| Role gating (viewer+ sees list/detail) | API / Backend | Browser (UX mirror only) | Backend `authorize(levelRead)` is the boundary; frontend `permissions.ts` mirrors for UX per Phase 1 doctrine |
| Status → color badge mapping | Browser / Client | — | Pure presentation over backend enum values; tokens already exist (`--success`, `--warning`) |
| i18n of statuses/fuel/labels | Browser / Client | — | Backend returns raw enum strings; FR/EN labels are frontend copy |

## Backend API Contract (verified against Go source)

### Endpoints relevant to this phase

All routes require `Authorization: Bearer <access_token>` and live under the **`/v1` prefix** (`server.go:57` — `v1 := e.Group("/v1")`; vehicles registered at `server.go:81-89`; rental-contracts at `server.go:125-139`).

| Method | Path | Query params | Response | Source |
|--------|------|--------------|----------|--------|
| GET | `/v1/vehicles` | `agency_id` (uuid, optional), `status` (optional, must be a valid status or 400) | `vehicleResponse[]` (200) — **no pagination, no envelope, plain JSON array** | `vehicle_handler.go:50-75` |
| GET | `/v1/vehicles/:vehicleID` | — | `vehicleResponse` (200); 404 if not found OR agency outside caller's read scope | `vehicle_handler.go:77-87`, `service.go` authorize |
| GET | `/v1/vehicles/:vehicleID/rental-contracts` | `status` (optional: `reserved\|active\|closed\|cancelled`, else 400) | `contractResponse[]` (200) | `rental_handler.go:181-206`, `server.go:131` |

Out-of-scope endpoints confirmed to exist (do NOT build UI for them — D-05): POST/PATCH/DELETE vehicles, PATCH `/status`, POST/GET `/mileage`, `GET /v1/vehicles/available`.

### `vehicleResponse` — exact JSON shape (`fleet_dto.go:55-74`)

| JSON field | Go type | TS type | Notes |
|------------|---------|---------|-------|
| `id` | uuid.UUID | `string` | UUIDv7 |
| `agency_id` | uuid.UUID | `string` | resolve agency name client-side from auth store's `agencies` (owner view) |
| `vin` | string | `string` | always present, 17 chars |
| `registration_plate` | string | `string` | uppercased server-side |
| `brand` | string | `string` | |
| `model` | string | `string` | |
| `model_year` | *int, `omitempty` | `number \| undefined` (`?:`) | ABSENT when nil |
| `color` | string, `omitempty` | `string \| undefined` (`?:`) | ABSENT when empty string |
| `fuel_type` | string | `FuelType` | `"petrol" \| "diesel" \| "hybrid" \| "electric" \| "lpg"` (`vehicle.go:44-50`) |
| `transmission` | string | `Transmission` | `"manual" \| "automatic"` (`vehicle.go:62-65`) |
| `seats` | *int, `omitempty` | `number \| undefined` (`?:`) | ABSENT when nil |
| `current_mileage` | int | `number` | km, always present |
| `status` | string | `VehicleStatus` | see enum below |
| `purchase_date` | *string, `omitempty` | `string \| undefined` (`?:`) | `YYYY-MM-DD` |
| `purchase_price_cents` | *int64, `omitempty` | `number \| undefined` (`?:`) | |
| `notes` | string, `omitempty` | `string \| undefined` (`?:`) | ABSENT when empty |
| `created_at` | time.Time | `string` | ISO 8601 |
| `updated_at` | time.Time | `string` | ISO 8601 |

**`omitempty` rule for the TS mirror:** every `omitempty` field must be optional (`?:`) in `src/types/fleet.ts`, exactly as `identity.ts` does for `AgencyResponse.address_line` etc. A non-optional `color: string` would type-lie: the key is simply missing from the JSON when empty.

### Vehicle status enum — exact values (`internal/domain/fleet/vehicle.go:17-22`)

```go
StatusAvailable   Status = "available"
StatusRented      Status = "rented"
StatusMaintenance Status = "maintenance"
StatusRetired     Status = "retired"
```

Exactly four values. `changeStatusRequest` validation confirms the closed set (`fleet_dto.go:46`: `oneof=available rented maintenance retired`). **Archived vehicles never appear** in list results — `fleet.sql:14-20` hard-filters `archived_at IS NULL` — so the UI never needs an "archived" state.

### `contractResponse` — fields needed for the current-contract summary (`rental_dto.go:83-105`)

| JSON field | TS type | Notes |
|------------|---------|-------|
| `id` | `string` | |
| `vehicle_id` | `string` | |
| `customer_id` | `string` | UUID only — **no customer name in this response**; Phase 2 shows the summary without a name (customer endpoints are Phase 3 scope) or displays the ID shortened. Recommendation: show dates + status + fuel/mileage, label the customer line with the ID only if the planner insists — cleanest is to omit customer identity entirely this phase |
| `status` | `ContractStatus` | `"reserved" \| "active" \| "closed" \| "cancelled"` (`contract.go:20-23`) |
| `starts_at`, `ends_at` | `string` | RFC3339 timestamps, always present |
| `actual_departure_at` | `string \| undefined` (`?:`) | `omitempty` |
| `departure_mileage` | `number \| undefined` (`?:`) | `omitempty` |
| `departure_fuel_level` | `FuelLevel \| undefined` (`?:`) | `omitempty` — `"empty" \| "quarter" \| "half" \| "three_quarters" \| "full"` (`contract.go:35-39`); set on activation, so always present on an `active` contract |
| `actual_return_at`, `return_mileage`, `return_fuel_level` | optional | `omitempty` — set on close |
| `cancel_reason`, `cancelled_at`, deposit fields | optional | not needed for the Phase 2 summary |
| `created_at`, `updated_at` | `string` | |

### Agency scoping — how the list is scoped (verified `usecase/fleet/service.go:144-167`)

1. No `agency_id` param → repository returns ALL non-archived org vehicles; then, **if the caller is org admin (owner/admin), everything is returned; otherwise the service post-filters to agencies where the caller has any membership** (`scope.CanRead`).
2. With `agency_id` param → 404 (`"agency not found"`) if the caller cannot read that agency; otherwise SQL-filtered to that agency.
3. RLS (`app.current_org_id` GUC) is the second barrier underneath.

**Frontend consequence (D-06 resolution):** pass `agency_id: currentAgencyId` **when `currentAgencyId` is non-null** (org admins after the switcher initializes), omit otherwise (non-admin members get their membership-scoped list automatically). This also satisfies Phase 1 success criterion 4 ("the shell reflects the newly selected agency context everywhere"). Note: `currentAgencyId` is only ever populated for org admins (`store.ts` — agencies list is owner-only) and is null on first paint until `GET /agencies` resolves; the query must key on it so switching agencies refetches: `["vehicles", "list", { agencyId, status }]`.

**D-03 tension noted for the planner:** when the list is filtered to the current agency, the "agency" column shows one value for every row. Keep the column (D-03 locks it for owner view) but resolve names client-side from `useAuthStore((s) => s.agencies)` — there is no agency name in `vehicleResponse`. For non-admins, `agencies` is empty; hide the column (they see only their own agencies anyway and cannot resolve names).

### Filtering strategy (D-03 discretion resolved)

- **Status filter → server-side** via `?status=`: the API supports it natively, and putting `status` in the query key gives cache-per-filter for free.
- **Text search (plate/brand/model) → client-side** over the fetched array: the API has no text param, the list is unpaginated, and fleet sizes for a rental agency (tens to low hundreds) make client filtering trivially fast. Use a local `useState` + `useMemo` filter; no debouncing infrastructure needed.

### Current-contract resolution strategy (FLEET-02)

No vehicle field or joined endpoint exposes the current contract. **Cheapest correct composition:**

```
GET /v1/vehicles/:vehicleID/rental-contracts?status=active   →  contracts[0] ?? null
```

- An `active` contract means departed-and-not-returned — at most one exists in practice (vehicle status machine only allows `rented → available` via a return; `vehicle.go:35-40`). Take `contracts[0]`, render "no current contract" state when the array is empty.
- Do NOT infer a contract from `vehicle.status === "rented"` — always ask the contracts endpoint; but the query can be unconditional (an `available` vehicle simply returns `[]`, one cheap request, no waterfall conditional logic).
- `reserved` contracts are NOT "current" (vehicle is still available); do not fetch them.

### Fuel level reality (FLEET-02 "fuel level")

The vehicle entity has **no fuel-level attribute** — verified across `vehicle.go` (domain), `fleet_dto.go` (DTO), `fleet.sql` (schema query: `SELECT *` over columns with no fuel level). The only fuel-level data in the whole API:

- `contractResponse.departure_fuel_level` — recorded at activation
- `contractResponse.return_fuel_level` — recorded at close

**Prescription:** the detail page shows `fuel_type` (a vehicle attribute, FR labels below) always, and shows the **active contract's `departure_fuel_level`** as the fuel-level reading inside the current-contract summary card. When no active contract exists, there is no fuel level to show — render nothing / "—" rather than inventing a value (D-02: never invent client-side state). The list's D-03 "fuel level" column should therefore display **`fuel_type`** (the only per-vehicle fuel datum that exists); flag this to the user at verify time as a contract-driven interpretation, not a UI omission.

## Standard Stack

### Core (all already installed — no new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | 5.101.4 | vehicle list/detail/contract queries | already the app's data layer (`TopBar.tsx:42-46`) [VERIFIED: package.json + Phase 1 source] |
| `ky` (`src/shared/api/client.ts`) | 2.0.2 | authed HTTP with single-flight refresh | mandatory shared client (D-06) [VERIFIED: codebase] |
| `@tanstack/react-router` | 1.170.18 | `/vehicules` + `/vehicules/$vehicleId` file routes | existing router; routes generated by `scripts/generate-routes.mjs` [VERIFIED: codebase] |
| `react-i18next` / `i18next` | 17.0.10 / 26.3.6 | all copy (D-07) | existing runtime, FR default [VERIFIED: codebase] |
| `zustand` (`useAuthStore`) | 5.0.14 | `currentAgencyId`, `agencies`, scope | existing store [VERIFIED: codebase] |
| shadcn vendored components | in `src/shared/ui/` | Badge, Skeleton, Card, Button, Input, EmptyState | Phase 1 vendored set [VERIFIED: codebase] |

### Supporting (new vendored files, zero npm installs)

| Component | How to get it | When to Use |
|-----------|---------------|-------------|
| `table` (shadcn) | `npx shadcn@latest add table` → writes `src/shared/ui/table.tsx` (alias `ui: "@/shared/ui"` already configured in `components.json`) | Desktop dense table. The registry `table` is pure styled markup (`<table>` wrappers), **no new dependencies** — verify post-generate that no `next-themes`-style import snuck in, per the 01-02 sonner precedent |
| `select` (shadcn, optional) | `npx shadcn@latest add select` → `src/shared/ui/select.tsx`, built on the already-installed `radix-ui` package | Status filter dropdown. Alternative with zero new files: reuse the existing `dropdown-menu` (as AgencySwitcher does) — planner's choice; `select` is semantically better for a filter control |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain shadcn `table` + `useMemo` filter | shadcn `data-table` pattern (`@tanstack/react-table`) | data-table adds a new npm dependency and column-def indirection for sorting/pagination this phase doesn't need (API is unpaginated, one text filter + one status filter). NOT recommended for Phase 2; revisit if Phase 4's contract lists need real column sorting |
| Route-level `useQuery` in components | TanStack Router `loader` + `queryClient.ensureQueryData` | Phase 1 established component-level `useQuery` (TopBar); loaders would introduce a second data-fetch idiom for no Phase 2 gain. Stay with `useQuery` |

**Installation:** none (`npx shadcn@latest add table` vendors a file; it is not a package install).

## Package Legitimacy Audit

No new external packages are installed this phase. The shadcn CLI (`shadcn@4.14.0`, already a dependency) generates vendored source files only.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                         ┌──────────────────────────── Browser (wheelio-front) ───────────────────────────┐
                         │                                                                                │
  /vehicules ────────────►  VehicleListPage                                                               │
                         │   ├─ useVehiclesQuery({agencyId: currentAgencyId, status})                     │
                         │   │    key: ["vehicles","list",{agencyId,status}]                              │
                         │   ├─ client-side text filter (plate/brand/model, useMemo)                      │
                         │   └─ <table> (md+) / stacked <Card>s (<md)  → row click → navigate             │
                         │                                                                                │
  /vehicules/$vehicleId ─►  VehicleDetailPage                                                             │
                         │   ├─ useVehicleQuery(id)          key: ["vehicles","detail",id]                │
                         │   └─ useActiveContractQuery(id)   key: ["vehicles","detail",id,"active-contract"]
                         │                                                                                │
                         └───────────────┬──────────────────────────────┬─────────────────────────────────┘
                                         │ api.get("vehicles", {searchParams})      api.get(`vehicles/${id}/rental-contracts`,
                                         │                                          {searchParams:{status:"active"}})
                                         ▼                                          ▼
                         ┌──────────────────────────── wheelio-api (/v1, Bearer) ──────────────────────────┐
                         │  GET /v1/vehicles ?agency_id ?status        GET /v1/vehicles/:id                │
                         │  GET /v1/vehicles/:id/rental-contracts ?status=active                           │
                         │  (org scope + membership filter + RLS; archived_at IS NULL)                     │
                         └──────────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (mirrors `src/features/auth/`)

```
src/
├── features/fleet/
│   ├── api.ts                    # fetchVehicles / fetchVehicle / fetchActiveContract via shared `api`
│   ├── queries.ts                # query-key factory + useQuery hooks (keys: ["vehicles", ...] per D-06)
│   ├── VehicleList.tsx           # table (md+) + card stack (<md), search input, status filter
│   ├── VehicleDetail.tsx         # detail card + current-contract summary
│   ├── StatusBadge.tsx           # status → Badge + token color mapping (D-02)
│   └── *.test.tsx                # colocated component tests (Phase 1 convention)
├── routes/_authenticated/
│   ├── vehicules/
│   │   ├── index.tsx             # replaces placeholder vehicules.tsx → renders VehicleList
│   │   └── $vehicleId.tsx        # renders VehicleDetail (D-04 route shape /vehicules/$vehicleId)
├── types/fleet.ts                # VehicleResponse, VehicleStatus, FuelType, Transmission (mirror fleet_dto.go)
└── types/rental.ts               # ContractResponse, ContractStatus, FuelLevel (mirror rental_dto.go — Phase 4 will extend)
```

Note: `src/routes/_authenticated/vehicules.tsx` (placeholder) must be **deleted** when `vehicules/index.tsx` is created — two files claiming `/vehicules` breaks route generation. Test files inside `routes/` are excluded from generation by `routeFileIgnorePattern: "\\.test\\."` (shared by `scripts/generate-routes.mjs` and vite config) — keep any route test named `*.test.tsx`.

### Pattern 1: Query hook following the TopBar precedent

```typescript
// Source: existing pattern src/app/shell/TopBar.tsx:42-46, extended per D-06
// src/features/fleet/queries.ts
import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { useAuthStore } from "@/shared/auth/store";
import type { VehicleResponse, VehicleStatus } from "@/types/fleet";
import type { ContractResponse } from "@/types/rental";

export function useVehiclesQuery(status: VehicleStatus | null) {
  const agencyId = useAuthStore((s) => s.currentAgencyId);
  return useQuery({
    queryKey: ["vehicles", "list", { agencyId, status }],
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (agencyId) searchParams.set("agency_id", agencyId);
      if (status) searchParams.set("status", status);
      return api.get("vehicles", { searchParams }).json<VehicleResponse[]>();
    },
  });
}

export function useVehicleQuery(vehicleId: string) {
  return useQuery({
    queryKey: ["vehicles", "detail", vehicleId],
    queryFn: () => api.get(`vehicles/${vehicleId}`).json<VehicleResponse>(),
  });
}

export function useActiveContractQuery(vehicleId: string) {
  return useQuery({
    queryKey: ["vehicles", "detail", vehicleId, "active-contract"],
    queryFn: async () => {
      const contracts = await api
        .get(`vehicles/${vehicleId}/rental-contracts`, {
          searchParams: { status: "active" },
        })
        .json<ContractResponse[]>();
      return contracts[0] ?? null; // never undefined: react-query rejects undefined data
    },
  });
}
```

### Pattern 2: Status badge with semantic tokens (D-02)

Tokens `--success` / `--warning` (+ `--color-success`/`--color-warning` Tailwind bridges) already exist in `src/index.css:143-146` and were explicitly reserved by 01-UI-SPEC for the vehicle "available" and "maintenance" badges. The vendored `badgeVariants` has no success/warning variants — pass utility classes via `className` (or extend the cva variants, planner's choice):

```typescript
// src/features/fleet/StatusBadge.tsx — one entry PER backend enum value, exhaustive
const statusStyles: Record<VehicleStatus, string> = {
  available:   "bg-success/10 text-success",        // UI-SPEC: Success token reserved for this
  rented:      "bg-primary/10 text-primary",        // accent = in-revenue state
  maintenance: "bg-warning/10 text-warning",        // UI-SPEC: Warning token reserved for this
  retired:     "border-border text-muted-foreground", // outline/muted, out-of-fleet
};
// <Badge variant="outline" className={statusStyles[status]}>{t(`vehicles.status.${status}`)}</Badge>
```

The `Record<VehicleStatus, string>` shape makes TypeScript fail compilation if the backend enum mirror gains a value — the drift-detection idiom this repo already uses for DTOs.

### Pattern 3: i18n keys (extend `common.json`, both locales)

```jsonc
"vehicles": {
  "title": "Véhicules",
  "searchPlaceholder": "Rechercher par plaque, marque ou modèle",
  "statusFilterLabel": "Filtrer par statut",
  "statusFilterAll": "Tous les statuts",
  "status": { "available": "Disponible", "rented": "Loué", "maintenance": "En maintenance", "retired": "Retiré" },
  "fuelType": { "petrol": "Essence", "diesel": "Diesel", "hybrid": "Hybride", "electric": "Électrique", "lpg": "GPL" },
  "fuelLevel": { "empty": "Vide", "quarter": "1/4", "half": "1/2", "three_quarters": "3/4", "full": "Plein" },
  "transmission": { "manual": "Manuelle", "automatic": "Automatique" },
  "columns": { "plate": "...", "vehicle": "...", "status": "...", "mileage": "...", "fuelType": "...", "agency": "..." },
  "empty": { "heading": "Aucun véhicule", "body": "..." },
  "noResults": "...",           // populated list, filter matches nothing (distinct from true-empty)
  "loadError": "...", "retry": "Réessayer",
  "detail": { "notFound": "...", "currentContract": "...", "noCurrentContract": "...", ... }
}
```

Existing keys already available: `vehicleCount_one` / `vehicleCount_other` (`common.json:56-57`) for the list's count line; `nav.vehicles` for the page/nav title. Every new key needs its EN mirror in `en/common.json` — the i18n test suite (`i18n.test.ts`) asserts key parity.

### Pattern 4: UI states (D-09, exact reuse)

- **Loading:** `<Skeleton>` rows shaped like the table (existing `src/shared/ui/skeleton.tsx`).
- **Error:** inline banner + `Réessayer` button calling `refetch()` — same structure as AppShell's `/me` error banner (`shell.meError`/`shell.retry` precedent).
- **Empty (zero vehicles):** `<EmptyState titleKey="vehicles.empty.heading" descriptionKey="vehicles.empty.body" />` — EmptyState was explicitly designed for key overrides (`empty-state.tsx` doc comment).
- **No-results (filter mismatch on a populated list):** distinct copy (`vehicles.noResults`) — do not reuse the true-empty state.
- **Detail 404:** backend returns 404 for both nonexistent and out-of-scope vehicles (deliberate invisibility, `service.go` authorize) — show a not-found state with a back-to-list link, never an "access denied" distinction.

### Anti-Patterns to Avoid

- **Deriving a current contract from `vehicle.status`** — always ask the contracts endpoint; status alone cannot yield dates/fuel/mileage and can race a just-closed return.
- **Constructing Scope or role logic locally** — role gating for this phase is "any authenticated user sees list+detail" (D-08); nothing to gate client-side beyond what `_authenticated` already guards.
- **Hardcoding status→French strings in components** — statuses render via `t(\`vehicles.status.${status}\`)`; raw enum values never reach the DOM.
- **Adding `@tanstack/react-table`** — see Alternatives; not this phase.
- **Marking new fields non-optional when the Go tag says `omitempty`** — the TS mirror must be honest about absent keys.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Authed fetch + 401 refresh retry | any new fetch wrapper | `api` from `src/shared/api/client.ts` | single-flight refresh already handles token rotation/theft-detection races |
| Cache/refetch on agency switch | manual useEffect refetch | query key containing `agencyId` | TanStack Query refetches automatically when the key changes; `queryClient.clear()` on logout already purges cross-org data (`TopBar.tsx:146`) |
| Status filter validation | client-side enum guessing | backend's own 400 on invalid `?status=` + the closed `VehicleStatus` union | backend is source of truth (D-02) |
| Table/select primitives | bespoke components | shadcn registry `table` / `select` vendored into `src/shared/ui/` | design-token consistency, a11y, Phase 1 vendoring convention |
| Plural "N véhicules" | string concat | existing `vehicleCount` CLDR plural keys | already shipped in Phase 1 i18n |

**Key insight:** this phase is contract-mirroring, not invention — every hard problem (auth, scoping, tokens, i18n plumbing) was solved in Phase 1; Phase 2's risk is drift from the backend contract, mitigated by verbatim DTO mirrors and exhaustive `Record<Enum, …>` maps.

## Common Pitfalls

### Pitfall 1: `/v1` base-URL drift (WILL 404 against the real backend)
**What goes wrong:** every wheelio-api route lives under `/v1` (`server.go:57`), but `.env.example` sets `VITE_API_URL=http://localhost:8080` and nothing in the frontend appends `/v1` (verified: zero `/v1` occurrences in `src/`). `api.get("vehicles")` → `http://localhost:8080/vehicles` → 404.
**Why it happens:** Phase 1 ran entirely against MSW handlers that derive their URLs from the same `VITE_API_URL`, so mocks and client agreed with each other while both disagreed with the real server.
**How to avoid:** set `VITE_API_URL=http://localhost:8080/v1` in `.env.example` (and any local `.env`). ky v2 `baseUrl` joins relative paths correctly (`auth/refresh` → `/v1/auth/refresh`). MSW handlers keep working unchanged since they interpolate `${API_URL}`. Make this the phase's first, standalone commit.
**Warning signs:** first manual test against `make run`'s backend returns 404 on login.

### Pitfall 2: Vehicle "fuel level" doesn't exist on the vehicle
**What goes wrong:** planner tasks say "show fuel level" and the executor invents a field or renders `undefined`.
**How to avoid:** list column = `fuel_type`; detail fuel *level* = active contract's `departure_fuel_level` only. Documented above; plan tasks must use these exact field names.
**Warning signs:** any task text referencing `vehicle.fuel_level`.

### Pitfall 3: Optional-field mirroring (`omitempty`)
**What goes wrong:** `color`, `notes`, `model_year`, `seats`, `purchase_date`, `purchase_price_cents` are ABSENT keys (not `null`, not `""`) when unset; on contracts, `departure_fuel_level` etc. are absent until activation. Non-optional TS types make tests pass on mocks and explode on real data (`.toLocaleString()` on undefined).
**How to avoid:** mirror every `omitempty` as `?:` in `types/fleet.ts`/`types/rental.ts`; MSW fixtures should include at least one vehicle WITH the optional fields absent.

### Pitfall 4: Route file collision when replacing the placeholder
**What goes wrong:** creating `routes/_authenticated/vehicules/index.tsx` while `routes/_authenticated/vehicules.tsx` still exists → duplicate `/vehicules` path in the generated route tree (`routeTree.gen.ts` is regenerated by pretest/predev hooks, so the failure appears in every script).
**How to avoid:** delete the placeholder file in the same task that creates the directory; also update `placeholders.test.tsx`, which imports `Route as VehiculesRoute from "./vehicules"` and asserts it renders EmptyState — that import breaks AND the assertion is now wrong. Remove the vehicules entries from that test.

### Pitfall 5: `currentAgencyId` initial-null flash for org admins
**What goes wrong:** on first paint, `currentAgencyId` is null until `GET /agencies` resolves and the TopBar effect picks agency[0]; the vehicles query fires unfiltered (all-org list), then refires agency-filtered — a visible content swap.
**How to avoid:** acceptable (fast) — but the planner may gate the list query with `enabled` only for org admins if the flash matters. Simplest correct behavior: let the key change drive the refetch; skeletons cover the transition. Do NOT block non-admins on `currentAgencyId` (theirs is permanently null by design — `store.ts:51-53`, agencies never load for non-admins).

### Pitfall 6: No pagination — don't build for it, don't fake it
`GET /vehicles` returns the entire scoped fleet (`fleet.sql:14-20`, plain SELECT, ordered `brand, model, registration_plate`). No `page`/`limit` params exist. Don't add pagination UI, don't slice client-side; render all rows (dense table is the point, D-01). If fleets grow, that's a backend change first.

### Pitfall 7: MSW handler URL params
MSW v2 matches paths, not query strings — the `GET ${API_URL}/vehicles` handler must read `request.url` search params itself to honor `agency_id`/`status` in tests, and the rental-contracts handler must key on `:vehicleId` path param (`http.get(\`${API_URL}/vehicles/:vehicleId/rental-contracts\`, ...)`). Type all fixture bodies against `types/fleet.ts`/`types/rental.ts` so contract drift fails compilation (existing `handlers.ts` convention).

## Code Examples

### TS mirror for `types/fleet.ts` (verbatim from `fleet_dto.go:55-74`)

```typescript
/** Mirrors wheelio-api internal/adapter/httpapi/fleet_dto.go vehicleResponse.
 *  omitempty fields are optional — absent keys, never null. */
export type VehicleStatus = "available" | "rented" | "maintenance" | "retired";
export type FuelType = "petrol" | "diesel" | "hybrid" | "electric" | "lpg";
export type Transmission = "manual" | "automatic";

export interface VehicleResponse {
  id: string;
  agency_id: string;
  vin: string;
  registration_plate: string;
  brand: string;
  model: string;
  model_year?: number;
  color?: string;
  fuel_type: FuelType;
  transmission: Transmission;
  seats?: number;
  current_mileage: number;
  status: VehicleStatus;
  purchase_date?: string; // YYYY-MM-DD
  purchase_price_cents?: number;
  notes?: string;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}
```

### TS mirror for `types/rental.ts` (subset needed this phase, from `rental_dto.go:83-105`)

```typescript
export type ContractStatus = "reserved" | "active" | "closed" | "cancelled";
export type FuelLevel = "empty" | "quarter" | "half" | "three_quarters" | "full";

export interface ContractResponse {
  id: string;
  vehicle_id: string;
  customer_id: string; // UUID only — no customer name in this response
  status: ContractStatus;
  starts_at: string;  // RFC3339
  ends_at: string;    // RFC3339
  actual_departure_at?: string;
  departure_mileage?: number;
  departure_fuel_level?: FuelLevel;
  actual_return_at?: string;
  return_mileage?: number;
  return_fuel_level?: FuelLevel;
  cancel_reason?: string;
  cancelled_at?: string;
  deposit_amount_cents?: number;
  deposit_method?: string;
  deposit_returned_amount_cents?: number;
  deposit_returned_at?: string;
  deposit_note?: string;
  created_at: string;
  updated_at: string;
}
```

### Mileage display

Use the existing `numeric-cell` utility (tabular-nums, added in 01-02 specifically "for future mileage/DZD table cells") on the mileage column: `<td className="numeric-cell">{v.current_mileage.toLocaleString(locale)} km</td>` with locale from `useLocale()`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| shadcn `style: new-york`/`baseColor` init flags | shadcn CLI 4.14 preset system (Nova preset, base: radix, alias `ui: "@/shared/ui"`) | Phase 1 execution (01-02-SUMMARY) | `npx shadcn@latest add table` writes into `src/shared/ui/` automatically; inspect generated file for stray imports (the sonner/next-themes precedent) |
| ky v1 positional hooks / `prefixUrl` | ky v2 destructured hook state / `baseUrl` / `ky.retry` | Phase 1 (client.ts header comment) | any new usage of `api` needs no changes; never create a second ky instance |
| shadcn `form` component | `field` component | Phase 1 | irrelevant this phase (no forms — read-only) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `npx shadcn@latest add table` generates a dependency-free `table.tsx` under the v4.14 CLI (true of the registry component historically; this project's CLI generation not yet exercised for `table`) | Standard Stack | Low — worst case, hand-write the ~20-line styled table wrappers with existing tokens; executor should inspect the generated file before committing |
| A2 | At most one `active` contract exists per vehicle at a time (enforced by the status machine in practice, not by a DB constraint on *status*) | Current-contract resolution | Low — `contracts[0]` on a status-filtered list is still the correct display choice |

All other claims are `[VERIFIED: source read]` against wheelio-api/wheelio-front files cited inline.

## Open Questions (RESOLVED)

1. **List "fuel level" column semantics (D-03)** — the API has no per-vehicle fuel level; this research prescribes `fuel_type` for the column. Surface to the user at verification: "the backend tracks fuel level per contract, not per vehicle; list shows fuel type instead."
2. **Current-contract summary content** — `contractResponse` exposes `customer_id` only (no name; customer endpoints are Phase 3). Prescription: summary shows period (`starts_at`→`ends_at`), status badge, departure mileage/fuel; customer identity omitted this phase.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node/npm toolchain, Vite, Vitest | build/test | ✓ | per package.json (vite 8.1.5, vitest 4.1.10) | — |
| shadcn CLI | vendoring `table`/`select` | ✓ | 4.14.0 (installed dependency) | hand-write components with existing tokens |
| wheelio-api running locally | manual verification only | assumed (sibling repo, `make run`) | Go 1.26 backend | MSW-mocked dev/test path works without it |

No missing blocking dependencies.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (jsdom, globals) + Testing Library + MSW 2.15.0; Playwright 1.61.1 for e2e |
| Config file | `vitest.config.ts` (note `--no-experimental-webstorage` execArgv) |
| Quick run command | `npx vitest run src/features/fleet` |
| Full suite command | `npm test` (runs pretest route generation first) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FLEET-01 | List renders fetched vehicles with status badges (one per backend enum value) | component (MSW) | `npx vitest run src/features/fleet/VehicleList.test.tsx` | ❌ Wave 0/this phase |
| FLEET-01 | Status filter refetches with `?status=`; text search filters client-side on plate/brand/model | component (MSW spy on request URL) | same file | ❌ |
| FLEET-01 | Loading skeleton, error+retry banner, empty state, no-results state all render per D-09 | component | same file | ❌ |
| FLEET-01 | Org-admin query passes `agency_id=currentAgencyId`; non-admin omits it | component/hook test asserting request search params | same file | ❌ |
| FLEET-02 | Detail renders plate/brand/model/mileage/fuel type from `GET /vehicles/:id` mock | component (MSW) | `npx vitest run src/features/fleet/VehicleDetail.test.tsx` | ❌ |
| FLEET-02 | Active contract summary renders when `?status=active` returns one; "no current contract" when `[]` | component (MSW) | same file | ❌ |
| FLEET-02 | 404 vehicle → not-found state (no crash) | component (MSW 404 handler) | same file | ❌ |
| D-07 | New i18n keys exist in both FR and EN | existing `i18n.test.ts` parity check | `npx vitest run src/shared/i18n` | ✅ extends existing |
| routes | `/vehicules` and `/vehicules/$vehicleId` present in generated tree; placeholder gone | route test (mirror `router.test.tsx` pattern) | `npx vitest run src/app/router.test.tsx` | ✅ extend |

### Sampling Rate
- **Per task commit:** `npx vitest run src/features/fleet` (plus touched shared suites)
- **Per wave merge:** `npm test`
- **Phase gate:** `npm test` green + `npm run build` (tsc -b catches DTO/type drift) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/test/mocks/handlers.ts` — add `GET /vehicles` (honoring `agency_id`/`status` search params), `GET /vehicles/:vehicleId`, `GET /vehicles/:vehicleId/rental-contracts` handlers, typed against the new DTO files
- [ ] `src/test/fixtures/fleet.ts` — vehicle fixtures covering all 4 statuses + one vehicle with all `omitempty` fields absent; one active-contract fixture
- [ ] Update `src/routes/_authenticated/placeholders.test.tsx` — remove the vehicules placeholder entries (route stops rendering EmptyState)
- Framework install: none needed

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (inherited) | shared ky client Bearer + single-flight refresh — no new auth surface this phase |
| V3 Session Management | yes (inherited) | Phase 1 session bootstrap/guard; `queryClient.clear()` on logout already prevents cross-org cache bleed for the new vehicle queries |
| V4 Access Control | yes | Backend `authorize(levelRead)` + RLS is the boundary; frontend renders what the API returns, never re-derives access (D-08). Out-of-scope vehicles are 404s — render not-found, don't leak "exists but forbidden" |
| V5 Input Validation | minimal | Read-only phase: only inputs are the text search (client-side only, never sent) and the status select (closed enum). No forms, no zod schemas needed |
| V6 Cryptography | no | none client-side |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via API-sourced strings (plate, brand, notes) | Tampering | React JSX auto-escaping; never `dangerouslySetInnerHTML` (no phase need) |
| IDOR probing `/vehicules/$vehicleId` | Information disclosure | backend org+membership scoping returns 404 (verified `service.go`); frontend shows generic not-found |
| Cross-org data residue after logout | Information disclosure | existing `queryClient.clear()` in UserMenu logout covers all `["vehicles", ...]` caches |

## Sources

### Primary (HIGH confidence — source files read this session)
- wheelio-api: `internal/adapter/httpapi/vehicle_handler.go`, `fleet_dto.go`, `rental_handler.go`, `rental_dto.go`, `server.go` (routes :57,81-89,125-139)
- wheelio-api: `internal/domain/fleet/vehicle.go` (status/fuel/transmission enums, transitions), `internal/domain/rental/contract.go` (contract status + fuel level enums)
- wheelio-api: `internal/usecase/fleet/service.go` (ListVehicles scoping :144-167, authorize), `ports.go` (VehicleFilter), `internal/adapter/postgres/queries/fleet.sql` (archived filter, ordering, no pagination)
- wheelio-front: `src/shared/api/client.ts`, `src/app/shell/TopBar.tsx`, `src/shared/auth/{permissions,store}.ts`, `src/routes/_authenticated.tsx`, `src/test/mocks/handlers.ts`, `src/test/fixtures/scope.ts`, `src/shared/ui/{badge,empty-state}.tsx`, `src/index.css`, `vitest.config.ts`, `package.json`, `.env.example`
- wheelio-front planning: `01-UI-SPEC.md`, `01-02-SUMMARY.md` (shadcn 4.14 preset drift), `02-CONTEXT.md`, `ROADMAP.md`

### Secondary / Tertiary
- none needed — no external web research performed; all claims grounded in repo source.

## Metadata

**Confidence breakdown:**
- API contract: HIGH — read directly from Go handlers/DTOs/domain/SQL with line refs
- Frontend patterns: HIGH — lifted from shipped Phase 1 code, not invented
- shadcn `table` generation detail: MEDIUM — CLI 4.14 generation for `table` not yet exercised in this repo (A1)

**Research date:** 2026-07-23
**Valid until:** contract-stable — valid as long as wheelio-api's fleet/rental DTOs are unchanged (backend is shipped/frozen for this milestone); re-verify `fleet_dto.go`/`rental_dto.go` if the API repo gains commits touching them
