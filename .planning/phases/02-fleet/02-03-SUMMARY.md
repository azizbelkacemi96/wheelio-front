---
phase: 02-fleet
plan: 03
subsystem: ui
tags: [react, tanstack-query, tanstack-router, shadcn, i18n, msw, vitest]

# Dependency graph
requires:
  - phase: 02-01
    provides: "useVehicleQuery + useActiveContractQuery hooks, StatusBadge, vehicles.detail.* / contracts.status.* FR/EN i18n, fleet fixtures + MSW handlers (404 on unknown id)"
  - phase: 02-02
    provides: "vehicules/ route directory + $vehicleId stub (typed link target), VehicleList composition patterns, jsdom Radix polyfills"
provides:
  - "VehicleDetail screen at /vehicules/$vehicleId: vehicle identity card + current-contract summary, full D-09 state coverage, generic 404 not-found state"
  - "Real /vehicules/$vehicleId route replacing the 02-02 EmptyState stub"
  - "Router integration test proving list -> detail routing through the generated tree"
affects: [fleet-detail, phase-2-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two parallel component-level queries (vehicle + active-contract) failing INDEPENDENTLY — a contract-query error renders inline inside its card without blanking the loaded vehicle page"
    - "Presence-guarded optional rows (field !== undefined) for omitempty-absent JSON keys — never a formatting call on an absent key, never the literal 'undefined'"
    - "404 discrimination via ky isHTTPError(err) && err.response.status === 404 -> one generic not-found state (no forbidden-vs-missing distinction, threat T-02-06)"

key-files:
  created:
    - src/features/fleet/VehicleDetail.tsx
    - src/features/fleet/VehicleDetail.test.tsx
  modified:
    - src/routes/_authenticated/vehicules/$vehicleId.tsx
    - src/app/router.test.tsx

key-decisions:
  - "Overwrote the 02-02 $vehicleId EmptyState stub in place (its frontmatter already declared this file) — one detail route file, not a second"
  - "Vehicle-query non-404 errors reuse the existing vehicles.loadError / vehicles.retry copy (no new i18n keys) to keep FR/EN parity — the i18n parity test forbids one-sided additions"
  - "routeTree.gen.ts regenerated but NOT committed — gitignored in this repo (predev/prebuild/pretest hooks), consistent with 02-02"

requirements-completed: [FLEET-02]

coverage:
  - id: D-04a
    description: "/vehicules/{id} shows plate, brand/model, locale-formatted mileage, translated fuel type + transmission, status badge, VIN"
    requirement: FLEET-02
    verification:
      - kind: unit
        ref: "src/features/fleet/VehicleDetail.test.tsx#renders the vehicle card: plate heading, brand/model, mileage, translated fuel type, transmission, and status badge"
        status: pass
    human_judgment: false
  - id: D-04b
    description: "Optional fields (model_year/color/seats/notes) render when present, are omitted when absent, and never render 'undefined'"
    requirement: FLEET-02
    verification:
      - kind: unit
        ref: "src/features/fleet/VehicleDetail.test.tsx#renders optional fields when present (model_year, color, seats, notes)"
        status: pass
      - kind: unit
        ref: "src/features/fleet/VehicleDetail.test.tsx#omits absent optional fields — never renders the string 'undefined'"
        status: pass
    human_judgment: false
  - id: D-04c
    description: "Current-contract card shows period, translated status, departure mileage, and departure fuel LEVEL when an active contract exists"
    requirement: FLEET-02
    verification:
      - kind: unit
        ref: "src/features/fleet/VehicleDetail.test.tsx#renders the current-contract card with period, translated status, departure mileage, and departure fuel level"
        status: pass
    human_judgment: false
  - id: D-04d
    description: "Empty contracts array -> noCurrentContract copy; no value invented from vehicle.status"
    requirement: FLEET-02
    verification:
      - kind: unit
        ref: "src/features/fleet/VehicleDetail.test.tsx#shows the noCurrentContract copy when the contracts endpoint returns []"
        status: pass
    human_judgment: false
  - id: D-04e
    description: "Unknown/out-of-scope id -> generic not-found state with a working back-to-list link"
    requirement: FLEET-02
    verification:
      - kind: unit
        ref: "src/features/fleet/VehicleDetail.test.tsx#renders the not-found state with a working back link for an unknown vehicle id"
        status: pass
    human_judgment: false
  - id: D-09
    description: "D-09 states: skeleton while pending; vehicle load-error banner + retry; contract-only error stays inline without blanking the page"
    requirement: FLEET-02
    verification:
      - kind: unit
        ref: "src/features/fleet/VehicleDetail.test.tsx#renders skeletons while the vehicle query is pending"
        status: pass
      - kind: unit
        ref: "src/features/fleet/VehicleDetail.test.tsx#shows the vehicle load-error banner with a working retry on a 500"
        status: pass
      - kind: unit
        ref: "src/features/fleet/VehicleDetail.test.tsx#shows the contract load-error inline in the card WITHOUT blanking the page when only the contract query fails"
        status: pass
    human_judgment: false
  - id: D-04route
    description: "/vehicules/$vehicleId resolves to VehicleDetail through the real generated route tree"
    requirement: FLEET-02
    verification:
      - kind: integration
        ref: "src/app/router.test.tsx#navigating to /vehicules/{id} resolves the detail screen through the real route tree"
        status: pass
    human_judgment: false

# Metrics
duration: ~1 session
completed: 2026-07-27
status: complete
---

# Phase 2 Plan 03: Vehicle Detail Screen Summary

**FLEET-02 vehicle detail at /vehicules/$vehicleId — vehicle identity card (plate, VIN, mileage, fuel type, transmission, status badge, presence-guarded optional fields) plus a current-contract summary card (period, translated status, departure mileage + fuel LEVEL) resolved from two parallel queries, with full D-09 states and a generic 404 not-found fallback. This plan closes Phase 2.**

## Performance
- **Tasks:** 2 (Task 1 TDD)
- **Files:** 2 created, 2 modified (routeTree.gen.ts regenerated but gitignored)

## Accomplishments
- `VehicleDetail` composes `useVehicleQuery` + `useActiveContractQuery` **in parallel** (no waterfall, no inference of a contract from `vehicle.status`).
- Vehicle info card: VIN, locale-formatted mileage (`numeric-cell` + km), translated fuel **type**, translated transmission, and presence-guarded `model_year` / `color` / `seats` / `notes` rows (omitempty-absent keys never trigger a formatting call, never render `undefined`).
- Current-contract card: period (`starts_at → ends_at`, `toLocaleDateString`), translated contract status, departure mileage, and translated departure fuel **LEVEL** — the only fuel-level reading the API exposes. Customer identity deliberately omitted (only `customer_id` exists this phase — threat T-02-08).
- D-09 state machine: skeleton while pending; a non-404 vehicle-query error shows the `vehicles.loadError` banner with a working retry; a 404 renders one generic not-found state (no forbidden-vs-missing distinction — threat T-02-06); a contract-only error renders **inline inside the contract card** with its own retry and does NOT blank the loaded vehicle page.
- Wired the real `/vehicules/$vehicleId` route (overwriting the 02-02 `EmptyState` stub) and extended `router.test.tsx` with a list→detail navigation assertion through the generated route tree.

## Task Commits
1. **Task 1: VehicleDetail component + tests (TDD)** — `0ed2470` (feat) — 9 behavior tests written RED, then implemented GREEN.
2. **Task 2: wire $vehicleId route + router test + phase gate** — `e755632` (feat).

## Files Created/Modified
- `src/features/fleet/VehicleDetail.tsx` — the detail screen (vehicle card + contract card + D-09 states + not-found).
- `src/features/fleet/VehicleDetail.test.tsx` — 9 behavior tests covering every behavior-block line.
- `src/routes/_authenticated/vehicules/$vehicleId.tsx` — real route reading `Route.useParams` → `<VehicleDetail>` (was the 02-02 stub).
- `src/app/router.test.tsx` — new test: navigating to `/vehicules/{id}` resolves the detail heading through the real tree.

## Decisions Made
- **Overwrote the stub in place.** Plan 02-02 created `$vehicleId.tsx` as a typed `EmptyState` link target and 02-03's frontmatter already lists it under `files_modified`; replaced it rather than creating a second file.
- **No new i18n keys.** Non-404 vehicle errors reuse `vehicles.loadError` / `vehicles.retry`; the plan-listed `vehicles.detail.*`, `contracts.status.*`, `vehicles.fuelType.*`, `vehicles.fuelLevel.*`, `vehicles.transmission.*` all already existed in FR + EN. The i18n parity test enforces identical key sets, so a one-sided addition would fail — none was needed.
- **routeTree.gen.ts not committed** — gitignored (regenerated by the predev/prebuild/pretest hooks), consistent with the 02-02 decision.

## Deviations from Plan
None affecting production behavior. Two minor, plan-anticipated adjustments:
- The plan's Task-2 step "commit the regenerated `src/routeTree.gen.ts`" does not apply — the file is gitignored in this repo (same as 02-02). The tree is still regenerated and exercised by the test/build gates.
- Removed an unused `within` import from the test flagged by `tsc -b` (Rule 1, test-only). No behavior change.

## Phase Gate Results
- `npx tsc --noEmit` — **clean** (exit 0).
- `npm run build` — **green** (built in ~256ms; `_vehicleId` chunk emitted).
- `npx vitest run` — **114/114 passed** (17 files); up from 104 (9 new VehicleDetail tests + 1 router test).
- `npx playwright test` — **4 pre-existing auth-spec failures**, NOT a regression from this plan. All four fail at the login step (`toHaveURL('/')` stays at `/login`) in the `e2e/auth.spec.ts` phase-1 happy path. Verified identical failures at the pre-02-03 baseline commit `4160216` in a clean worktree, so plan 02-03 introduced no E2E regression. No E2E spec covers the `/vehicules` detail route; the phase-1 E2E already ran in mocked-API mode (STATE.md 01-07 decision) and this environment's headless login flow does not complete. Flagged for verification, not a 02-03 defect.

## Known Stubs
None. The 02-02 `$vehicleId` `EmptyState` stub has been fully replaced by the real `VehicleDetail`.

## Threat Flags
None new. XSS surface (API strings in cards) mitigated by React JSX auto-escaping, no `dangerouslySetInnerHTML` (T-02-07). IDOR probing renders one generic not-found state, never confirming existence (T-02-06). `customer_id` omitted from the contract summary entirely (T-02-08).

## Next Phase Readiness
- FLEET-01 + FLEET-02 both complete and green. Phase 2 success criteria are demonstrable end-to-end against mocks: list at `/vehicules`, detail at `/vehicules/{id}`.
- Phase 2 is ready for `/gsd-verify-work`. The 4 pre-existing Playwright auth failures are an environment/phase-1 concern to resolve during verification, independent of the fleet work.

---
*Phase: 02-fleet*
*Completed: 2026-07-27*
