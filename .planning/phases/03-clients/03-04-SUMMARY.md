---
phase: 03-clients
plan: 04
subsystem: ui
tags: [react, tanstack-router, tanstack-query, msw, i18n, customer, e2e]

requires:
  - phase: 03-clients
    plan: 01
    provides: "src/types/customer.ts DTO mirror, MSW customer/driver handlers+fixtures, src/features/customers/{api,queries}.ts (useCustomerQuery, useCustomerDriversQuery), customers.* i18n namespace"
  - phase: 03-clients
    plan: 03
    provides: "src/routes/_authenticated/clients/$customerId.tsx typed EmptyState stub (this plan's fill target), the create form's navigation target"
provides:
  - "src/features/customers/CustomerDetail.tsx — the real /clients/$customerId screen: individual identity+license card, company card + designated-drivers list, generic not-found, independent parallel-query failure handling"
  - "src/routes/_authenticated/clients/$customerId.tsx — real route (replaces the 03-02/03-03 EmptyState stub)"
  - "src/app/router.test.tsx — /clients/{id} integration assertion through the real generated route tree"
  - "customers.detail.driversLoadError i18n key (FR+EN)"
affects: []

tech-stack:
  added: []
  patterns:
    - "Two parallel TanStack Query reads with no waterfall (useCustomerQuery + useCustomerDriversQuery), mirroring VehicleDetail's useVehicleQuery + useActiveContractQuery — the drivers query fires unconditionally regardless of customer type (backend returns [] for individuals), but the drivers SECTION only renders once type resolves to company"
    - "Date-only (YYYY-MM-DD) fields formatted via a local formatDate() that constructs Date(year, month-1, day) instead of new Date(dateOnlyString) — avoids a UTC-parse timezone shift that new Date() would introduce for calendar dates"

key-files:
  created:
    - src/features/customers/CustomerDetail.tsx
    - src/features/customers/CustomerDetail.test.tsx
  modified:
    - src/routes/_authenticated/clients/$customerId.tsx
    - src/app/router.test.tsx
    - src/shared/i18n/fr/common.json
    - src/shared/i18n/en/common.json

key-decisions:
  - "License fields (license_number/license_issued_at/license_valid_until) render only in the individual branch — a company entity has no personal driving license (mirrors 03-03's same decision for the create form); the whole LicenseCard is omitted entirely when no license data is present, rather than showing an empty card"
  - "Phone/address (DTO 'Shared' fields) are rendered for BOTH individual and company branches, presence-guarded — the plan's action text only explicitly named them for company, but they are shared contact fields on the DTO and are present on the individual fixtures; omitting them for individuals would silently drop real data the backend returns (Rule 2 — missing critical, treated as a completeness gap, not a scope expansion)"
  - "Added customers.detail.driversLoadError (FR+EN) — the plan required an inline drivers-error banner but no dedicated i18n key existed for it (customers.loadError/retry are generic list-level copy); mirrors vehicles.detail.contractLoadError's naming convention"
  - "Drivers query is fired unconditionally (parallel with the customer query, no waterfall) even for individual customers, exactly like VehicleDetail's always-on contract query — the backend's MSW mock (and real endpoint) returns [] for a non-company id, so no wasted-looking empty section ever renders since the drivers SECTION itself is gated on customer.type === 'company', not on the query result"

patterns-established:
  - "Pattern: presence-guard every optional/nullable DTO field individually via `!== undefined` (omitempty) or `!= null` (nullable-and-optional) before rendering — no field ever falls through to a literal 'undefined'"

requirements-completed: [CUST-01, CUST-02, CUST-03]

coverage:
  - id: D1
    description: "CustomerDetail renders individual customer fields (full_name, identity_doc_type + number, phone/address) plus a presence-guarded license card, and shows NO drivers section"
    requirement: "CUST-01"
    verification:
      - kind: unit
        ref: "src/features/customers/CustomerDetail.test.tsx#renders individual fields ... with NO drivers section"
        status: pass
    human_judgment: false
  - id: D2
    description: "CustomerDetail renders company fields (legal_name, rc, nif, nis, phone/address) and lists its designated drivers (full_name + license_number) from GET /customers/{id}/drivers"
    requirement: "CUST-03"
    verification:
      - kind: unit
        ref: "src/features/customers/CustomerDetail.test.tsx#renders company fields (legal_name + rc/nif/nis) and its designated drivers"
        status: pass
    human_judgment: false
  - id: D3
    description: "Omitempty/nullable fields are presence-guarded on a bare customer fixture — never renders the literal 'undefined'"
    requirement: "CUST-01"
    verification:
      - kind: unit
        ref: "src/features/customers/CustomerDetail.test.tsx#omits absent optional fields on a bare customer"
        status: pass
    human_judgment: false
  - id: D4
    description: "Unknown/out-of-scope customer id (404) renders one generic not-found state with a working back-to-list link (T-03-11 — never an access-denied variant)"
    requirement: "CUST-01"
    verification:
      - kind: unit
        ref: "src/features/customers/CustomerDetail.test.tsx#renders the not-found state with a working back link for an unknown customer id"
        status: pass
    human_judgment: false
  - id: D5
    description: "Customer query loading skeleton and a load-error banner with working retry on a 500"
    requirement: "CUST-01"
    verification:
      - kind: unit
        ref: "src/features/customers/CustomerDetail.test.tsx#renders skeletons while the customer query is pending, #shows the customer load-error banner with a working retry on a 500"
        status: pass
    human_judgment: false
  - id: D6
    description: "The customer and drivers queries fail independently — a drivers-query error shows an inline banner inside the drivers card with retry and never blanks the page; the customer fields above still render"
    requirement: "CUST-03"
    verification:
      - kind: unit
        ref: "src/features/customers/CustomerDetail.test.tsx#shows the drivers load-error inline in the drivers card WITHOUT blanking the page"
        status: pass
    human_judgment: false
  - id: D7
    description: "The 03-02/03-03 $customerId EmptyState stub is replaced by the real CustomerDetail; /clients/{id} resolves it through the real generated route tree end-to-end (closing the create-form and list-row navigation loops)"
    requirement: "CUST-03"
    verification:
      - kind: integration
        ref: "src/app/router.test.tsx#navigating to /clients/{id} resolves the detail screen through the real route tree"
        status: pass
    human_judgment: false
  - id: D8
    description: "Phase 3 gate: full unit suite, tsc --noEmit, production build, and Playwright E2E all green"
    verification:
      - kind: unit
        ref: "npx vitest run (187 tests, 24 files, all pass)"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit"
        status: pass
      - kind: other
        ref: "npm run build"
        status: pass
      - kind: e2e
        ref: "npx playwright test (e2e/auth.spec.ts, 4/4 pass)"
        status: pass
    human_judgment: false
  - id: D9
    description: "Human end-of-phase UAT: create an individual customer with identity doc + license, create a company customer with RC/NIF/NIS + drivers, find and open an existing customer via search"
    verification: []
    human_judgment: true
    rationale: "Requires a human to drive the actual create-then-find-then-open flow through the running app (human_verify_mode=end-of-phase per config); automated tests cover each screen's behavior in isolation but not the human's end-to-end judgment call on the full round trip."

duration: 10min
completed: 2026-07-28
status: complete
---

# Phase 3 Plan 4: Customer Detail Screen + Phase 3 Gate Summary

**`/clients/$customerId` ships with presence-guarded individual/company fields, a company-only designated-drivers list from an independently-failing parallel query, and a generic not-found state — closing the phase loop with a green full-suite/tsc/build/Playwright gate.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-28T08:26:00Z (approx, first commit at 08:26:32Z)
- **Completed:** 2026-07-28T08:28:20Z
- **Tasks:** 2
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- Built `CustomerDetail.tsx`: composes `useCustomerQuery(id)` + `useCustomerDriversQuery(id)` (03-01) as two parallel, non-waterfalled reads — mirrors `VehicleDetail.tsx`'s exact contract-query pattern. Individual customers get an Identity card (full_name, identity doc type + number, phone/address) plus a License card (only rendered when license data is present); company customers get a Company card (legal_name/rc/nif/nis/phone/address) plus a Drivers card listing each designated driver's full_name + license_number + optional dates.
- Every optional/nullable field is presence-guarded individually (`!== undefined` for omitempty keys, `!= null` for the nullable license dates) — verified against a fully-bare customer fixture that never renders the literal `"undefined"`.
- A 404 on the customer query renders one generic not-found state (never an access-denied variant, per threat T-03-11); a non-404 customer error and a drivers-query error each get their own inline banner + retry — the drivers error stays inside its own card and never blanks the customer fields above it.
- Replaced the 03-02/03-03 `EmptyState` stub at `src/routes/_authenticated/clients/$customerId.tsx` with the real route, wiring `Route.useParams()` into `CustomerDetail`.
- Added a `/clients/{id}` integration assertion to `router.test.tsx` (mirrors the existing `/vehicules/{id}` test), proving list/create-form → detail routing resolves through the real generated route tree.
- Ran the full Phase 3 gate: `npx vitest run` (187 tests / 24 files), `npx tsc --noEmit`, `npm run build`, and `npx playwright test` (4/4 `auth.spec.ts` tests) — all green with no regressions.

## Task Commits

Each task was committed atomically (Task 1 followed the RED/GREEN TDD gate):

1. **Task 1a: failing CustomerDetail tests (RED)** - `7b03bbc` (test)
2. **Task 1b: CustomerDetail + $customerId route fill (GREEN)** - `31c91e3` (feat)
3. **Task 2: router integration assertion + Phase 3 gate** - `8c49940` (test)

## Files Created/Modified

- `src/features/customers/CustomerDetail.tsx` - the real detail screen
- `src/features/customers/CustomerDetail.test.tsx` - 7 tests covering the full behavior block
- `src/routes/_authenticated/clients/$customerId.tsx` - real route (replaces the EmptyState stub)
- `src/app/router.test.tsx` - added the `/clients/{id}` real-route integration test
- `src/shared/i18n/fr/common.json` / `src/shared/i18n/en/common.json` - added `customers.detail.driversLoadError`

## Decisions Made

- License fields render only in the individual branch (mirrors 03-03's same call for the create form) — the LicenseCard is omitted entirely (not shown empty) when no license data is present on the customer.
- Phone/address render for both individual and company branches, presence-guarded — these are DTO "Shared" fields present on real individual fixtures; the plan's action text named them explicitly only for company but excluding them for individuals would drop real backend data (see Deviations).
- The drivers query fires unconditionally in parallel with the customer query (no waterfall), matching VehicleDetail's always-on contract query — the drivers SECTION is gated on `customer.type === "company"`, not on the query result, so an individual never shows a stray empty drivers card.
- Date-only fields (`license_issued_at`/`license_valid_until`, both customer- and driver-level) are formatted via a local `formatDate()` that builds `new Date(year, month-1, day)` from the split string, avoiding the timezone-shift risk of `new Date("YYYY-MM-DD")`, which parses as UTC midnight and can display a day off in negative-offset locales.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Added `customers.detail.driversLoadError` i18n key (FR+EN)**
- **Found during:** Task 1, implementing the drivers-query inline error banner
- **Issue:** The plan requires an inline error banner inside the drivers card on a drivers-query failure, but no i18n key existed for that specific copy — `customers.loadError`/`customers.retry` are generic list-level strings, not a drivers-specific message, and D-06 forbids bare-literal copy.
- **Fix:** Added `customers.detail.driversLoadError` to both `fr/common.json` and `en/common.json`, mirroring the naming convention of `vehicles.detail.contractLoadError` from 02-03.
- **Files modified:** `src/shared/i18n/fr/common.json`, `src/shared/i18n/en/common.json`
- **Verification:** `CustomerDetail.test.tsx`'s drivers-error test asserts the translated French copy renders; i18n FR/EN key-parity test remains green.
- **Committed in:** `7b03bbc` (Task 1 RED commit, added alongside the test that needs it)

**2. [Rule 2 - Missing critical] Rendered phone/address for individual customers, not only company**
- **Found during:** Task 1, implementing the Identity card
- **Issue:** The plan's action text names phone/address only in the company branch's field list, but `phone`/`address` are marked "Shared" in `types/customer.ts` and are present on the individual fixtures (`customerIndividualCin` has both). Omitting them from the individual branch would silently drop real, backend-returned contact data the screen has no other way to surface (no edit/contract screens exist yet to show it elsewhere).
- **Fix:** Added presence-guarded `phone`/`address` rows to the Identity card alongside the company card's existing rows.
- **Files modified:** `src/features/customers/CustomerDetail.tsx`
- **Verification:** `npx tsc --noEmit` clean; existing individual-fixture test still passes (it doesn't specifically assert phone/address, but nothing regressed); no new test added specifically for this row since it follows the exact same presence-guard pattern already covered by the company-card assertions and the bare-customer omission test.
- **Committed in:** `31c91e3` (Task 1 GREEN commit)

---

**Total deviations:** 2 auto-fixed (both Rule 2 — missing critical i18n/data-completeness gaps the plan's own text implied but didn't fully spell out).
**Impact on plan:** Both fixes are strictly additive completeness fixes required to honor the plan's own "presence-guarded rows... when present" contract and D-06's no-bare-literals rule. No scope creep, no architectural change.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 3 (clients) is functionally complete: CUST-01/02/03 all closed across 03-01 through 03-04. The full unit suite (187 tests across 24 files), `tsc --noEmit`, `npm run build`, and `npx playwright test` (4/4) are all green.
- The end-of-phase human UAT (human_verify_mode=end-of-phase per config) still needs to run via `/gsd-verify-work`: (1) create an individual with identity doc + license, (2) create a company with RC/NIF/NIS + drivers, (3) find and open an existing customer via search — flagged as coverage D9 (human_judgment: true) in this summary.
- Phase 4 (rental contracts) can compose the customer detail/list/create screens as its own navigation targets (e.g., a contract form linking a customer); no further customer-module work is needed before Phase 4 planning.

---
*Phase: 03-clients*
*Completed: 2026-07-28*

## Self-Check: PASSED

All 4 declared artifacts found on disk; all 3 commit hashes (`7b03bbc`, `31c91e3`, `8c49940`) verified present in `git log --oneline --all`.
