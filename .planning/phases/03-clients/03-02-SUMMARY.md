---
phase: 03-clients
plan: 02
subsystem: ui
tags: [react, tanstack-router, tanstack-query, msw, i18n, customer, e2e]

requires:
  - phase: 03-clients
    plan: 01
    provides: "src/types/customer.ts DTO mirror, MSW customer handlers/fixtures, src/features/customers/{api,queries}.ts (useCustomersQuery), customers.* i18n namespace"
  - phase: 02-fleet
    provides: "VehicleList.tsx pattern (responsive table/card, D-09 state quartet), StatusBadge.tsx token-map pattern, Table/Select shadcn primitives"
provides:
  - "src/features/customers/CustomerList.tsx — the real /clients screen: server-side ?q= search (debounced ~300ms into the query key), responsive table(md+)/card(<md), full skeleton/error+retry/empty/noResults quartet"
  - "src/features/customers/CustomerTypeBadge.tsx — i18n-labelled, Record<CustomerType,string> token badge"
  - "src/routes/_authenticated/clients/index.tsx — real route registering CustomerList (Phase 1 placeholder retired)"
  - "src/routes/_authenticated/clients/\\$customerId.tsx — typed EmptyState stub (Link target for CustomerList rows; pulled forward from 03-03 to satisfy this plan's own tsc-clean requirement)"
affects: [03-03, 03-04]

tech-stack:
  added: []
  patterns:
    - "Server-side search pattern: debounce raw input state into a second 'committed' state that feeds the query key directly (contrasts with fleet's client-side useMemo filter over an already-fetched array)"

key-files:
  created:
    - src/features/customers/CustomerList.tsx
    - src/features/customers/CustomerList.test.tsx
    - src/features/customers/CustomerTypeBadge.tsx
    - src/features/customers/CustomerTypeBadge.test.tsx
    - src/routes/_authenticated/clients/index.tsx
    - src/routes/_authenticated/clients/$customerId.tsx
  modified:
    - src/routes/_authenticated/placeholders.test.tsx
    - src/app/router.test.tsx
    - e2e/auth.spec.ts
  deleted:
    - src/routes/_authenticated/clients.tsx

key-decisions:
  - "Pulled the \\$customerId typed stub route forward from 03-03 into this plan (Rule 3 — blocking issue): CustomerList's own row Link to /clients/\\$customerId cannot type-check under tsc -b without a registered route target, and this plan's own verification requires tsc --noEmit clean. Mirrors the exact precedent 02-02 set for vehicules/\\$vehicleId (stub created in the SAME plan as the list, not deferred). 03-03 will find the stub already present when it executes and should treat its own 'create the stub' instruction as a no-op / already-satisfied."
  - "Search debounce implemented as two local useState values (raw `search` + committed `q`) with a setTimeout effect, rather than a shared debounce hook — no debounce hook exists yet in the codebase and this is the only current caller, so introducing shared infra was out of scope"
  - "Company badge token deliberately reuses the neutral 'retired' style class (border-border text-muted-foreground) rather than a new color token — customer type is a category distinction, not a status/health signal, so no success/warning semantics apply"

requirements-completed: [CUST-03]

coverage:
  - id: D1
    description: "CustomerList renders every customer with display name (legal_name for company, full_name for individual) + type badge, responsive table/card"
    requirement: "CUST-03"
    verification:
      - kind: unit
        ref: "src/features/customers/CustomerList.test.tsx (fixture rendering + card-stack tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Server-side ?q= search: typing debounces into useCustomersQuery(q)'s cache key, driving a new network request (not a client array filter)"
    requirement: "CUST-03"
    verification:
      - kind: unit
        ref: "src/features/customers/CustomerList.test.tsx#typing a search term issues a NEW request"
        status: pass
    human_judgment: false
  - id: D3
    description: "Skeleton / error+retry / empty / noResults state quartet"
    requirement: "CUST-03"
    verification:
      - kind: unit
        ref: "src/features/customers/CustomerList.test.tsx (4 dedicated state tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "CustomerTypeBadge — i18n label, raw enum never in the DOM, tsc-checked enum exhaustiveness"
    requirement: "CUST-03"
    verification:
      - kind: unit
        ref: "src/features/customers/CustomerTypeBadge.test.tsx"
        status: pass
    human_judgment: false
  - id: D5
    description: "/clients resolves to CustomerList through the real generated route tree; Phase 1 placeholder retired"
    requirement: "CUST-03"
    verification:
      - kind: unit
        ref: "src/app/router.test.tsx#navigating to /clients renders the real customer list"
        status: pass
    human_judgment: false
  - id: D6
    description: "placeholders.test.tsx no longer imports/asserts ClientsRoute; base-placeholder example tests repointed to /etats-des-lieux"
    requirement: "CUST-03"
    verification:
      - kind: unit
        ref: "src/routes/_authenticated/placeholders.test.tsx"
        status: pass
    human_judgment: false
  - id: D7
    description: "E2E placeholder assertions migrated off /clients onto /etats-des-lieux; GET /customers defensive mock added; all 4 auth.spec.ts tests green"
    requirement: "CUST-03"
    verification:
      - kind: e2e
        ref: "e2e/auth.spec.ts (npx playwright test)"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-07-28
status: complete
---

# Phase 3 Plan 2: Customer List + Search Screen Summary

**The real `/clients` screen ships: server-side `?q=` search (debounced into the TanStack Query cache key), responsive table/card list, the full skeleton/error/empty/noResults quartet, and the mandatory E2E/placeholder-test migration off `/clients` onto `/etats-des-lieux`.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-28T07:51:00Z (approx, prior wave commit at 07:51:19)
- **Completed:** 2026-07-28T07:58:32Z
- **Tasks:** 3
- **Files modified:** 10 (6 created, 3 modified, 1 deleted)

## Accomplishments

- Built `CustomerList.tsx`: server-side search — unlike fleet's client-side `useMemo` filter, the typed term is debounced (~300ms) into `useCustomersQuery(q)`'s own cache key so the backend does the filtering; responsive `Table` (md+) + `Card` stack (<md), both always in the DOM; full skeleton/error+retry/empty/noResults state coverage; each row links to `/clients/$customerId`
- Built `CustomerTypeBadge.tsx` mirroring `StatusBadge.tsx`'s token-map idiom — a new backend `CustomerType` value fails `tsc`, and the raw enum string never reaches the DOM
- Converted `/clients` from the Phase 1 flat placeholder into a real route directory (`clients/index.tsx` registering `CustomerList`), and pulled the `$customerId` stub route forward from 03-03 so `CustomerList`'s own row `Link` type-checks (see Deviations)
- Migrated `placeholders.test.tsx`'s `ClientsRoute` references and the E2E `auth.spec.ts` placeholder assertions onto `/etats-des-lieux`, added a defensive `GET /customers -> []` E2E mock, and extended `router.test.tsx` with a `/clients` real-route integration assertion — closing the blocking research warning the instant `/clients` became real

## Task Commits

Each task was committed atomically (Task 1 followed the RED/GREEN TDD gate):

1. **Task 1a: failing tests (RED)** - `7cc9d5e` (test), `5a4b2e7` (test)
2. **Task 1b: CustomerList + CustomerTypeBadge (GREEN)** - `61f6e0f` (feat)
3. **Task 2: /clients route directory conversion + placeholder/router test migration** - `11480f6` (feat)
4. **Task 3: E2E placeholder migration off /clients** - `002890e` (fix)

## Files Created/Modified

- `src/features/customers/CustomerList.tsx` - the real list/search screen
- `src/features/customers/CustomerList.test.tsx` - 9 tests covering the full behavior block
- `src/features/customers/CustomerTypeBadge.tsx` - i18n token badge
- `src/features/customers/CustomerTypeBadge.test.tsx` - 3 tests (FR/EN + enum-drift guard)
- `src/routes/_authenticated/clients.tsx` - DELETED (Phase 1 placeholder)
- `src/routes/_authenticated/clients/index.tsx` - real route (CustomerList)
- `src/routes/_authenticated/clients/$customerId.tsx` - typed EmptyState stub (see Deviations)
- `src/routes/_authenticated/placeholders.test.tsx` - dropped `ClientsRoute`, repointed base-placeholder examples to `/etats-des-lieux`
- `src/app/router.test.tsx` - added the `/clients` real-route integration test
- `e2e/auth.spec.ts` - migrated 3 placeholder assertion blocks off `/clients`, added `GET /customers` mock

## Decisions Made

- Pulled the `$customerId` typed stub route forward from plan 03-03 into this plan (Rule 3 — blocking issue): `CustomerList`'s own row `Link` needs a registered target to type-check under `tsc -b`, and this plan's own `<verification>` requires `tsc --noEmit` clean. This mirrors 02-02's exact precedent for `vehicules/$vehicleId` (stub created in the same plan as the list). **Flag for 03-03's executor:** the stub already exists — its own "create the $customerId stub" instruction is already satisfied; it only needs to replace the stub's `EmptyState` component wiring if/when it adds the create-form's navigation target, and 03-04 still does the real fill-in.
- Implemented the search debounce as two local `useState` values (raw `search` + committed `q`) behind a `setTimeout` effect rather than introducing a shared debounce hook — no such hook exists in the codebase yet and `CustomerList` is the only current caller.
- Company type badge reuses the neutral "retired"-style token (`border-border text-muted-foreground`) rather than a new color — type is a category, not a health/status signal.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Pulled forward the `$customerId` stub route from plan 03-03**
- **Found during:** Task 2 (route conversion), surfaced by `npx tsc --noEmit`
- **Issue:** `CustomerList.tsx` (Task 1) links each row to `/clients/$customerId` via a typed TanStack Router `Link`. That route target was scheduled to be created in plan 03-03 (per `03-03-PLAN.md`'s own "stubbed here" language), but this plan's Task 2 `<verify>` block and the plan-level `<verification>` both require `npx tsc --noEmit` to pass — which is impossible without a registered `/clients/$customerId` route.
- **Fix:** Added `src/routes/_authenticated/clients/$customerId.tsx` as a typed `EmptyState` stub, mirroring `vehicules/$vehicleId.tsx`'s stub-then-fill precedent from 02-02/02-03. Regenerated `routeTree.gen.ts`.
- **Files modified:** `src/routes/_authenticated/clients/$customerId.tsx` (new)
- **Commit:** `11480f6`
- **Downstream note:** 03-03's plan text describes creating this same stub file — when that plan executes, the file will already exist and already be correct; its own stub-creation step is a no-op.

None else — the rest of the plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 03-03 (create form) can compose purely from the existing `customers.*` i18n, `hasOrgRole`, and the data layer; its own `$customerId` stub-creation step will find the file already present (see Deviations) and should skip re-creating it, going straight to wiring its own navigation target once the create mutation lands.
- 03-04 (detail screen) fills both the `$customerId` route (replacing the `EmptyState` stub added here) and composes `useCustomerQuery`/`useCustomerDriversQuery` from 03-01.
- Full unit suite (146 tests across 20 files), `tsc --noEmit`, `npm run build`, and `npx playwright test e2e/auth.spec.ts` (4/4) are all green with this plan's changes included.

---
*Phase: 03-clients*
*Completed: 2026-07-28*

## Self-Check: PASSED

All 6 declared artifacts found on disk; all 5 commit hashes (`7cc9d5e`, `5a4b2e7`, `61f6e0f`, `11480f6`, `002890e`) verified present in `git log --oneline --all`.
