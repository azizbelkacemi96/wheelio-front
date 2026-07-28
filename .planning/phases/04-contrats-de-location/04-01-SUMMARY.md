---
phase: 04-contrats-de-location
plan: 01
subsystem: contracts-data-layer
status: complete
tags: [rentals, tanstack-query, msw, i18n, timezone, tdd]
requires:
  - features/fleet (useVehiclesQuery, vehicle fixtures)
  - features/customers (customer fixtures)
  - shared/api/client (ky api + isHTTPError)
provides:
  - src/types/rental.ts request DTOs (CreateContractBody, ActivateBody, CloseInvoiceLine, CloseBody, CancelBody, DepositBody)
  - features/contracts/api.ts (createContract, activateContract, closeContract, cancelContract, recordDeposit, getContract, listContractsByVehicle)
  - features/contracts/queries.ts (useContractQuery, useContractsByVehicleQuery, useContractsForVehicles, useAllContractsQuery, useTodayOverviewQuery)
  - features/contracts/mutations.ts (useCreateContract, useActivate, useClose, useCancel, useRecordDeposit, overlapErrorKey, transitionErrorKey)
  - features/contracts/dateAlgiers.ts (dayKeyAlgiers, isTodayAlgiers, toRFC3339Algiers)
  - features/contracts/resolve.ts (byId, toContractView, ContractView)
  - test/fixtures/contracts.ts + MSW rentals handlers
  - i18n contracts.*/wizard.*/ops.* (FR+EN)
affects: [04-02, 04-03, 04-04, 04-05, 04-06]
tech-stack:
  added: []
  patterns: [useQueries fan-out + combine, Intl day-key timezone math, per-mutation 409 disambiguation, dual-namespace invalidation]
key-files:
  created:
    - src/features/contracts/api.ts
    - src/features/contracts/queries.ts
    - src/features/contracts/queries.test.tsx
    - src/features/contracts/mutations.ts
    - src/features/contracts/mutations.test.tsx
    - src/features/contracts/dateAlgiers.ts
    - src/features/contracts/dateAlgiers.test.ts
    - src/features/contracts/resolve.ts
    - src/features/contracts/resolve.test.ts
    - src/test/fixtures/contracts.ts
  modified:
    - src/types/rental.ts
    - src/test/mocks/handlers.ts
    - src/test/mocks/handlers.test.ts
    - src/shared/i18n/fr/common.json
    - src/shared/i18n/en/common.json
decisions:
  - "Overlap 409 detection in MSW is deterministic via window-intersection against reserved/active fixtures on the same vehicle (not a magic marker)"
  - "Fuel-level labels reuse existing vehicles.fuelLevel.* keys (identical enum) rather than duplicating under contracts.*"
  - "activeEndingTodayContract shares vehicleRented, so the pre-existing single-active-contract handler test was relaxed to membership (fixture drift from expanded coverage)"
metrics:
  duration: ~20m
  tasks: 3
  files_created: 10
  files_modified: 5
  tests_added: 31
  completed: 2026-07-28
---

# Phase 4 Plan 01: Rental Contract Data Foundation Summary

Client-side rental data layer for Phase 4: verbatim request DTOs, thin ky api, a `useQueries` fan-out read layer that replaces the non-existent list-all/today endpoints, lifecycle mutations with dual-namespace invalidation and per-mutation 409 disambiguation, Africa/Algiers day-key math, the UUID->plate/customer/agency join, and MSW handlers + fixtures + FR/EN i18n every downstream Phase-4 screen composes from.

## What was built

- **Request DTOs** appended to `src/types/rental.ts` (read-only Go mirror discipline kept): `CreateContractBody` (no deposit/agency_id — contract born reserved), `ActivateBody`, `CloseInvoiceLine`, `CloseBody`, `CancelBody`, `DepositBody`. `unit_price_ht_cents` documented as pre-VAT cents; `vat_rate` as integer percent.
- **`api.ts`** — thin calls over the shared `api` ky client, `encodeIdSegment` (encodeURIComponent) on every interpolated id (T-04-02). `listContractsByVehicle` builds URLSearchParams, only sets status when provided.
- **`dateAlgiers.ts`** — `dayKeyAlgiers` (Intl en-CA, timeZone Africa/Algiers), `isTodayAlgiers(iso, now=new Date())` (injectable now), `toRFC3339Algiers(local)` -> `${local}:00+01:00`. The 23:30 UTC -> next Algiers day boundary is explicitly asserted.
- **`resolve.ts`** — `byId`, `ContractView`, `toContractView` joining plate/agencyId from the vehicle and customerName (legal_name else full_name) from the customer; a missing join yields undefined (never throws).
- **`queries.ts`** — `useContractQuery`, `useContractsByVehicleQuery`, `useContractsForVehicles` (useQueries + combine: flatten data, OR isPending/isError), `useAllContractsQuery` (vehicles + no-filter fan-out, returns contracts AND vehicles for the join), `useTodayOverviewQuery` (reserved-today pickups + active-ending-today returns, Algiers-filtered). No invented endpoints.
- **`mutations.ts`** — `useCreateContract`, `useActivate`, `useClose`, `useCancel`, `useRecordDeposit`, all invalidating both `["contracts"]` and `["vehicles"]` on success. Pure helpers `overlapErrorKey` (create 409 -> `contracts.errors.overlap`) and `transitionErrorKey(kind, err)` (lifecycle 409 -> distinct `notReservable`/`notClosable`/`notCancellable`); raw problem.detail never surfaced (T-04-04).
- **Fixtures + MSW** — `test/fixtures/contracts.ts` with one contract per status + overlap pair + reserved-today/active-ending-today; MSW create/activate/close/cancel/get/deposit handlers incl. a deterministic overlap-409 `application/problem+json`. The per-vehicle list handler now reads the new fixtures so all four statuses are listable.
- **i18n** — `contracts.*` (extended, `status.*` untouched), `wizard.*`, `ops.*` in FR + EN with identical key sets (56/27/6 keys each namespace). Fuel labels reuse `vehicles.fuelLevel.*`.

## Exports downstream plans can rely on

- **Query hooks:** `useContractQuery(id)`, `useContractsByVehicleQuery(vehicleId, status?)`, `useContractsForVehicles(vehicleIds, status|null)`, `useAllContractsQuery()` (-> `{ vehicles, contracts, isPending, isError }`), `useTodayOverviewQuery()` (-> `{ vehicles, pickups, returns, isPending, isError }`).
- **Mutation hooks:** `useCreateContract()` (mutate `{ vehicleId, body }`), `useActivate(id)`, `useClose(id)`, `useCancel(id)`, `useRecordDeposit(id)`.
- **Error mappers:** `overlapErrorKey(error)`, `transitionErrorKey("activate"|"close"|"cancel", error)`.
- **Helpers:** `dayKeyAlgiers`, `isTodayAlgiers`, `toRFC3339Algiers`, `byId`, `toContractView`, `ContractView`.
- **i18n keys:** `contracts.{title,searchPlaceholder,noResults,loadError,retry,empty.*,columns.*,actions.*,errors.*,deposit.*,detail.*,filter.*}`, `wizard.{title,steps.*,nav.*,vehicle.*,customer.*,terms.*,departure.*,finish.*}`, `ops.{title,pickups.*,returns.*,emptyAll}`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing handler test relaxed for expanded fixtures**
- **Found during:** Task 1
- **Issue:** `handlers.test.ts` asserted `GET /vehicles/:id/rental-contracts?status=active` returns exactly ONE active contract for `vehicleRented`. The plan's required `activeEndingTodayContract` (OPS-01 returns) is also active on the same vehicle, so the list legitimately grew to two.
- **Fix:** changed the assertion from exact-length-1 to membership (all items active + the original `activeContractFixture` present). Faithful to the test's intent and to the plan's "all four statuses listable" requirement.
- **Files modified:** src/test/mocks/handlers.test.ts
- **Commit:** c0b898a

### Process deviation

- The RED test-only commit for Task 3 was denied at the permission prompt; per the user's "dropped git-commit ceremony" directive, Task 3's test + implementation were committed together in a single atomic commit (54dde98) instead of a split RED/GREEN pair. Task 2 retained the split (RED 568ff39, GREEN 911fe8d). All TDD gates (test written and observed failing before implementation) were still honored in-process.

## TDD Gate Compliance

- Task 2 & 3 followed RED (tests written, observed failing — modules absent) then GREEN (implemented, green). Task 2 has explicit `test(...)` (568ff39) then `feat(...)` (911fe8d) commits. Task 3's RED commit was denied by the permission system; its test+impl landed in one `feat(...)` commit (54dde98) — RED was still verified before implementing.

## Verification

- `npx tsc --noEmit` — clean.
- `npm run build` — built in ~255ms, no errors.
- `npx vitest run` — 28 files, 224 tests passed (was 193; +31 new).
- `npx vitest run src/features/contracts` — 22 passed.
- FR/EN parity across contracts.*/wizard.*/ops.* — 56/27/6 keys each, identical sets.
- No invented list-all or /today endpoint; agency_id is never read off contractResponse (resolved from the vehicle in resolve.ts).

## Known Stubs

None — this is a data/foundation layer; every export is wired to real MSW-backed behavior and tested. `wizard.departure.seamNote` intentionally names the Phase 5 inspection handoff (copy only; no stub logic).

## Self-Check: PASSED

- All six primary artifacts exist on disk (api/queries/mutations/dateAlgiers/resolve + fixtures).
- Commits c0b898a, 911fe8d, 54dde98 present in git history (plus RED test commit 568ff39 for Task 2).
