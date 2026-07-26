---
phase: 2
plan: "02-01"
wave: 1
status: complete
completed: 2026-07-26
requirements: [FLEET-01, FLEET-02]
---

# 02-01 — Fleet contract foundation — SUMMARY

## What shipped

Data/contract foundation for the Fleet phase. Three tasks, all committed, full suite green (92/92 vitest, tsc + build clean).

- **/v1 base-URL fix** (`e06f903`): every API base-URL fallback aligned on `http://localhost:8080/v1`. Backend routes all live under `/v1` (`server.go:57`); Phase 1 never hit it because MSW derives its base from the same env var. Fixed across all fallback literals + `.env.example` so a fresh clone talks to a real backend.
- **DTO mirrors + MSW handlers + fixtures** (`64fc0e2`, `76ed220`): `src/types/fleet.ts` (`VehicleResponse`, VehicleStatus/FuelType/Transmission enums), `src/types/rental.ts` (`ContractResponse`, ContractStatus/FuelLevel), verbatim from the Go source. `src/test/fixtures/fleet.ts` — 5 vehicles across all 4 statuses + both agencies + one `vehicleBare` (all omitempty absent); one `activeContractFixture` on `vehicleRented`. MSW handlers for `GET /vehicles` (agency_id/status filter, 400 on bad status), `GET /vehicles/:id` (404), `GET /vehicles/:id/rental-contracts` (status filter).
- **Fleet data layer** (`this task`): `src/features/fleet/api.ts` (thin fns over shared `api` ky client), `queries.ts` (3 hooks), `StatusBadge.tsx`, full `vehicles.*` + `contracts.status.*` FR/EN i18n.

## Key facts for downstream plans (02-02, 02-03)

- **ky uses `prefix`, NOT `baseUrl`.** `baseUrl: 'http://localhost:8080/v1'` (no trailing slash) does `new URL('vehicles', base)` → drops `/v1` → `http://localhost:8080/vehicles`. `prefix` joins with slash-normalization → correct `/v1/vehicles`. `client.ts` was migrated to `prefix` for both the `api` instance and the refresh call. This corrected the Phase 1 comment that wrongly claimed ky renamed `prefixUrl`→`baseUrl`.
- **Hooks (import from `@/features/fleet/queries`):**
  - `useVehiclesQuery(status: VehicleStatus | null)` — reads `currentAgencyId` from the auth store itself; key `["vehicles","list",{agencyId,status}]`; agency switch refetches for free. Do NOT gate non-admins on currentAgencyId (permanently null by design).
  - `useVehicleQuery(vehicleId)` — key `["vehicles","detail",id]`.
  - `useActiveContractQuery(vehicleId)` — key `["vehicles","detail",id,"active-contract"]`; resolves `contracts[0] ?? null` (never undefined).
- **StatusBadge** (`@/features/fleet/StatusBadge`) — `<StatusBadge status={v.status} />`, token-colored, i18n label.
- **Fuel reality:** vehicles carry `fuel_type` only (no fuel level). Fuel LEVEL exists solely on the active contract (`departure_fuel_level`). List shows `fuel_type`; detail's contract card shows the active contract's departure fuel level.
- **i18n:** all copy under top-level `vehicles.*` (title, searchPlaceholder, statusFilter*, status.*, fuelType.*, fuelLevel.*, transmission.*, columns.*, empty.*, noResults, loadError, retry, detail.*) + `contracts.status.*`. Nav label stays at `nav.vehicles`. `vehicleCount_one/_other` plurals already exist — reuse, don't duplicate.

## Deviations

- **[continuation]** The original executor (Fable) exhausted credits mid-Task 3 after writing the RED tests. Task 3 implementation (api.ts, queries.ts, StatusBadge.tsx, i18n) was completed by the orchestrator (Opus) against the already-written RED tests — same contract, no plan change.
- **[Rule 1, from Task 1]** ky `baseUrl`→`prefix` migration (see Key facts) — a real `/v1`-dropping bug, not a stylistic choice.

## Verification
- `npx vitest run` — 92/92 pass (15 files)
- `npx tsc --noEmit` — clean
- `npm run build` — clean
