---
phase: 02-fleet
reviewed: 2026-07-27T19:42:49Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - src/features/fleet/api.ts
  - src/features/fleet/queries.ts
  - src/features/fleet/StatusBadge.tsx
  - src/features/fleet/VehicleList.tsx
  - src/features/fleet/VehicleDetail.tsx
  - src/routes/_authenticated/vehicules/index.tsx
  - src/routes/_authenticated/vehicules/$vehicleId.tsx
  - src/types/fleet.ts
  - src/types/rental.ts
  - src/test/fixtures/fleet.ts
  - src/test/mocks/handlers.ts
  - src/shared/ui/table.tsx
  - src/shared/ui/select.tsx
  - src/shared/api/client.ts
  - e2e/auth.spec.ts
  - src/shared/i18n/fr/common.json
  - src/shared/i18n/en/common.json
  - src/shared/auth/store.ts
findings:
  critical: 1
  warning: 2
  info: 3
  total: 6
status: resolved
fixed: 2026-07-27
---

# Phase 02 (Fleet): Code Review Report

**Reviewed:** 2026-07-27T19:42:49Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Phase 02 delivers the fleet list + detail screens over a clean, well-documented
data layer. The heavily-scrutinized areas hold up under adversarial checks:

- **Contract fidelity — verified clean.** `VehicleResponse` (types/fleet.ts)
  and `ContractResponse` (types/rental.ts) match `vehicleResponse` /
  `contractResponse` in the backend `fleet_dto.go` / `rental_dto.go` field-for-
  field, including every `omitempty → ?:` mapping. Enum unions match the domain
  constants in `vehicle.go` / `contract.go` (`available|rented|maintenance|
  retired`, `petrol|diesel|hybrid|electric|lpg`, `manual|automatic`,
  `reserved|active|closed|cancelled`, `empty|quarter|half|three_quarters|full`).
- **ky `prefix` vs `baseUrl` — verified correct.** The installed `ky@2.0.2`
  genuinely exposes `prefix`, `baseUrl`, and `ky.retry` (confirmed in
  `node_modules/ky/distribution/types/options.d.ts`). The doc-comment's claim
  is accurate: `baseUrl` would run `new URL("vehicles", ".../v1")` and drop the
  `/v1` segment, while `prefix` concatenates with slash-normalization. The
  choice is right, and no request path hardcodes a non-`/v1` URL.
- **Query correctness — sound.** `useVehiclesQuery` keys on `{agencyId,status}`
  so agency switches refetch; non-admins are not gated on `currentAgencyId`;
  `fetchActiveContract` resolves `contracts[0] ?? null` (never `undefined`).
  The backend `ListContractsByVehicle` honors `?status=active`, so `[0]` is the
  active contract.
- **i18n — clean.** FR/EN key parity is exact (95/95 keys, zero diff on either
  side); every user-facing string in the new screens flows through `t()`.
- **Contract-card error isolation — correct.** A contract fetch failure is
  contained to `ContractCardBody`; the vehicle detail page still renders.

One correctness defect stands out: the vehicle-list filter unmounts its own
controls when a server-side status filter returns zero rows, stranding the user.

## Fix Log (2026-07-27, post-review)

CR-01 + both warnings fixed in `VehicleList.tsx` (commit follows), full gate green (115 vitest incl. 1 new CR-01 regression test, tsc/build/4-E2E clean):

| Finding | Fix | Regression test |
|---------|-----|-----------------|
| CR-01 | Controls now gate on `showControls = query.isSuccess && (vehicles.length > 0 \|\| isFilterActive)` — a zero-row filter keeps the Select mounted. Body distinguishes true-empty (`vehicles.length === 0 && !isFilterActive` → EmptyState) from filtered-to-zero (→ noResults). Count line gates on `filtered.length > 0`. | VehicleList.test.tsx "a status filter matching zero rows shows noResults AND keeps the filter control mounted" |
| WR-01 | Same true-empty vs no-matches split — a status filter with zero rows now shows `vehicles.noResults`, not the false "no vehicles registered" EmptyState. | (covered by the CR-01 test) |
| WR-02 | `agencyName` unresolved id → `"—"` fallback instead of a blank cell. | existing agency-column tests still green |

Info findings (IN-01 truthiness vs !==undefined, IN-02 bare "km" unit, IN-03 active-contract query fires on a 404 vehicle) left as-is — cosmetic / no user-visible defect; candidates for a later polish pass.

## Critical Issues

### CR-01: Status filter is a dead-end — its controls unmount when it returns zero rows

**File:** `src/features/fleet/VehicleList.tsx:91`, `:106`, `:187-194`
**Issue:** The search + status-filter block is gated on
`hasData = query.isSuccess && vehicles.length > 0` (line 91), and `vehicles` is
the already server-filtered array (`?status=` is applied by the API). When a
user selects a status that has no vehicles (e.g. a small agency whose cars are
all `available`, filtered to `rented`), the API returns `[]`, `hasData` becomes
`false`, and the entire controls `<div>` at line 106 unmounts. The Select that
holds the active filter value is gone, so the user has **no way to clear the
filter** short of a full page reload/navigation — the primary screen's filter
traps them. Compounding it, `VehicleListBody` then renders the
`vehicles.empty.*` state ("No vehicles are registered for this agency",
line 187-194), which is factually wrong: vehicles exist, just none in the
selected status.
**Fix:** Gate the controls on load success, not on row count, and keep the
filter mounted so it remains reversible:
```tsx
// line 91
const isLoaded = query.isSuccess;
const hasData = isLoaded && vehicles.length > 0;

// line 106 — render controls whenever data has loaded OR a status filter is
// active (so an empty filtered result never hides the way back).
{(hasData || status !== null) && (
  <div className="flex flex-col gap-2 sm:flex-row sm:items-center"> ... </div>
)}

// In VehicleListBody, distinguish "no vehicles at all" from "no vehicles for
// this status" by passing `status` down:
if (vehicles.length === 0) {
  return status !== null
    ? <p className="py-8 text-center text-sm text-muted-foreground">
        {t("vehicles.noResultsForStatus")}
      </p>
    : <EmptyState titleKey="vehicles.empty.heading"
                  descriptionKey="vehicles.empty.body" />;
}
```
(Add the `vehicles.noResultsForStatus` key to both FR/EN bundles.)

## Warnings

### WR-01: Empty-state copy conflates "no fleet" with "no matches for status filter"

**File:** `src/features/fleet/VehicleList.tsx:187-194`
**Issue:** Even independent of CR-01's control-unmount bug, the
`vehicles.length === 0` branch always renders `vehicles.empty.body`
("No vehicles are registered for this agency"). Because the status filter is
server-side, a zero-row response for `?status=maintenance` is indistinguishable
from a genuinely empty fleet, so an agency with a full fleet can be told it has
none. This misleads owners auditing their fleet.
**Fix:** Same mechanism as CR-01 — thread the active `status` into the body and
show a status-specific message when `status !== null`, reserving the "no
vehicles registered" copy for the unfiltered (`status === null`) case.

### WR-02: `agencyName` silently renders a blank cell for an unresolved agency id

**File:** `src/features/fleet/VehicleList.tsx:76-77`, `:280`, `:316`
**Issue:** `agencyName` does `agencies.find(a => a.id === agencyId)?.name ?? ""`.
If a vehicle's `agency_id` is not present in the owner's `agencies` store (stale
list, an agency added after the store was hydrated, or a cross-agency vehicle),
the table/card shows an empty Agency cell with no indication that the value is
missing rather than empty. Silent data holes are hard to notice in review and
in production.
**Fix:** Fall back to a visible placeholder instead of an empty string, e.g.
`?? "—"` (or log/skip). At minimum:
```tsx
agencies.find((a) => a.id === agencyId)?.name ?? "—";
```

## Info

### IN-01: `vehicleLabel` uses truthiness for `model_year` while the detail card uses `!== undefined`

**File:** `src/features/fleet/VehicleList.tsx:59-62`, `src/features/fleet/VehicleDetail.tsx:98-101` vs `VehicleDetail.tsx:160`
**Issue:** `vehicleLabel` guards with `v.model_year ? ...` (falsy-hides `0`),
while the detail info rows correctly use `!== undefined`. The backend
`gte=1950` constraint makes `0` impossible today, so this is harmless, but the
two idioms for the same optional field are an inconsistency that could bite if
constraints change.
**Fix:** Use `v.model_year !== undefined ? ... : base` in `vehicleLabel` for
parity with the presence-guard idiom used everywhere else.

### IN-02: `"km"` unit is a bare literal appended in three places

**File:** `src/features/fleet/VehicleList.tsx:78`, `src/features/fleet/VehicleDetail.tsx:133`, `:255`
**Issue:** `formatMileage` bakes the literal `" km"` outside i18n. The code
comment pre-acknowledges this, and `km` is locale-neutral for an FR/EN Algeria
audience, so it is not a real defect — but per D-07 ("no bare user-facing
literals") it is the one string in the fleet screens not routed through `t()`.
**Fix:** Optional — extract a `units.km` key, or leave as-is with the existing
comment. Non-blocking.

### IN-03: `useActiveContractQuery` fires for vehicles that 404

**File:** `src/features/fleet/VehicleDetail.tsx:49-50`
**Issue:** The contract query runs unconditionally at hook level, so a
not-found / out-of-scope vehicle still issues `GET
/vehicles/:id/rental-contracts`. The component early-returns `NotFoundState`
before rendering the contract card, so the wasted request is invisible — this
is a deliberate no-waterfall tradeoff (documented in the file header), not a
correctness bug. Noted only for completeness; performance is out of v1 scope.
**Fix:** None required. If ever desired, guard with `enabled:
!vehicleQuery.isError` on the contract query.

---

_Reviewed: 2026-07-27T19:42:49Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
