---
phase: 03-clients
plan: 01
subsystem: api
tags: [typescript, react-query, msw, i18n, rbac, customer]

requires:
  - phase: 02-fleet
    provides: "src/features/fleet/{api,queries}.ts pattern (thin ky calls + TanStack Query hooks), src/types/fleet.ts DTO-mirror convention, MSW handler/fixture conventions"
provides:
  - "src/types/customer.ts — verbatim TS mirror of wheelio-api customer_dto.go"
  - "hasOrgRole(scope, min) org-wide permission gate mirroring Scope.HasOrgRole"
  - "MSW customer handlers + fixtures (individual/cin, individual/passport, company, bare, drivers)"
  - "src/features/customers/{api,queries}.ts — org-scoped data layer (no agencyId)"
  - "customers.* i18n namespace in FR+EN (52 matching keys) + customerCount plural pair"
affects: [03-02, 03-03, 03-04]

tech-stack:
  added: []
  patterns:
    - "Org-wide permission axis (hasOrgRole) alongside the existing per-agency axis (canOperate/canRead/canManage) — used for resources with no agency boundary"
    - "Org-scoped query keys (no agencyId) as a deliberate contrast pattern to fleet's agency-keyed list"

key-files:
  created:
    - src/types/customer.ts
    - src/test/fixtures/customers.ts
    - src/features/customers/api.ts
    - src/features/customers/queries.ts
    - src/features/customers/queries.test.tsx
  modified:
    - src/shared/auth/permissions.ts
    - src/shared/auth/permissions.test.ts
    - src/test/mocks/handlers.ts
    - src/test/mocks/handlers.test.ts
    - src/shared/i18n/fr/common.json
    - src/shared/i18n/en/common.json

key-decisions:
  - "hasOrgRole is a literal port of wheelio-api Scope.HasOrgRole (scope.go:51) — admin shortcut + AtLeast(min) over ANY agency membership — kept fully separate from the existing per-agency canOperate/canRead/canManage helpers, which are documented as the WRONG gate for customer records"
  - "Customer query keys (['customers','list',{q}], ['customers','detail',id], ['customers','detail',id,'drivers']) deliberately carry NO currentAgencyId — customers are org-scoped per the backend contract, contrasting with fleet's agency-keyed vehicle list"
  - "Driver create with an unknown parent customer id returns 400 'unknown customer' in the MSW mock, mirroring service.go's ErrNotFound->ErrInvalid mapping (never a 404 on that endpoint)"

patterns-established:
  - "Pattern: org-wide vs per-agency dual permission axis in permissions.ts — future org-scoped resources reuse hasOrgRole"
  - "Pattern: server-side search customer fixtures/handlers filter case-insensitively over full_name/legal_name/identity_doc_number/rc for the ?q= param"

requirements-completed: [CUST-01, CUST-02, CUST-03]

coverage:
  - id: D1
    description: "hasOrgRole(scope, min) org-wide permission helper, literal port of Scope.HasOrgRole"
    requirement: "CUST-01"
    verification:
      - kind: unit
        ref: "src/shared/auth/permissions.test.ts#hasOrgRole"
        status: pass
    human_judgment: false
  - id: D2
    description: "src/types/customer.ts DTO mirror of customer_dto.go (CustomerResponse, DriverResponse, CreateCustomerBody, CreateDriverBody)"
    requirement: "CUST-01"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (MSW handler/fixture bodies typed against these types)"
        status: pass
    human_judgment: false
  - id: D3
    description: "MSW customer handlers (GET/POST /customers, GET /customers/:id, GET/POST /customers/:id/drivers) + fixtures covering individual/cin, individual/passport, company, and bare customers"
    requirement: "CUST-03"
    verification:
      - kind: unit
        ref: "src/test/mocks/handlers.test.ts (customer handler smoke tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Org-scoped customers data layer: useCustomersQuery(q), useCustomerQuery(id), useCustomerDriversQuery(id) with no agencyId anywhere"
    requirement: "CUST-03"
    verification:
      - kind: unit
        ref: "src/features/customers/queries.test.tsx (all 5 tests, incl. the no-agency_id/no-currentAgencyId invariant test)"
        status: pass
    human_judgment: false
  - id: D5
    description: "customers.* i18n namespace in FR+EN with matching key sets, covering list/create/drivers/errors/detail copy"
    requirement: "CUST-02"
    verification:
      - kind: unit
        ref: "src/shared/i18n/i18n.test.ts (existing suite, unaffected) + scripted key-parity check (52 customers.* keys, FR/EN identical)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-07-28
status: complete
---

# Phase 3 Plan 1: Customer Data/Contract Foundation Summary

**Org-scoped `hasOrgRole` permission axis, `src/types/customer.ts` DTO mirror, MSW customer handlers + fixtures, and the `src/features/customers/{api,queries}.ts` data layer with a full FR/EN `customers.*` i18n namespace — the Wave-1 backbone for CUST-01/02/03.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-28T07:43:40Z
- **Completed:** 2026-07-28T07:49:16Z
- **Tasks:** 3
- **Files modified:** 11 (5 created, 6 modified)

## Accomplishments

- Added `hasOrgRole(scope, min)` — a literal port of wheelio-api's `Scope.HasOrgRole` (org admin shortcut + AtLeast(min)-over-any-agency), documented as the correct gate for org-scoped resources like customers, distinct from the existing per-agency `canOperate`/`canRead`/`canManage`
- Added `src/types/customer.ts` as a verbatim, file:line-cited mirror of `customer_dto.go` (`CustomerResponse`, `DriverResponse`, `CreateCustomerBody`, `CreateDriverBody`), correctly modeling omitempty fields as optional/absent and the two license dates as `string | null`, and deliberately NOT modeling `archived_at` (absent from the response DTO)
- Extended MSW with a full customer handler set (search-filtered list, create-echo, detail 200/404, driver create 201/400, driver list) and fixtures covering individual+cin, individual+passport (no CIN), company, and a fully-bare customer
- Built the org-scoped `src/features/customers/{api,queries}.ts` data layer — three read hooks keyed without `currentAgencyId`, verified by a dedicated test that sets `currentAgencyId` in the store and asserts neither the URL nor the query key ever carries it
- Shipped the complete `customers.*` FR/EN i18n namespace (52 matching keys each) covering list/search, create form, drivers sub-form, field labels, error copy, and detail screen — plus a `customerCount_one`/`_other` plural pair — so the list (03-02), create form (03-03), and detail (03-04) plans are pure composition with zero bare JSX literals needed

## Task Commits

Each task was committed atomically:

1. **Task 1: hasOrgRole org-scope permission helper** - `d0246fe` (feat)
2. **Task 2: customer DTO mirror + MSW customer handlers + fixtures** - `d6db635` (feat)
3. **Task 3: customers api.ts + queries.ts + customers.* i18n** - `100b919` (feat)

## Files Created/Modified

- `src/types/customer.ts` - DTO mirror of `customer_dto.go` (CustomerResponse, DriverResponse, CreateCustomerBody, CreateDriverBody, CustomerType, IdentityDocType)
- `src/shared/auth/permissions.ts` - added `hasOrgRole(scope, min)` org-wide gate
- `src/shared/auth/permissions.test.ts` - added `describe("hasOrgRole", ...)` covering every case in the plan's behavior block
- `src/test/fixtures/customers.ts` - individual/cin, individual/passport, company, bare customer fixtures + 2 driver fixtures + `driversByCustomerId` lookup
- `src/test/mocks/handlers.ts` - added the "Customers (Phase 3)" handler section (5 new handlers)
- `src/test/mocks/handlers.test.ts` - added customer smoke assertions, updated handler count to 14
- `src/features/customers/api.ts` - thin ky calls: fetchCustomers, fetchCustomer, fetchCustomerDrivers, createCustomer, createDriver
- `src/features/customers/queries.ts` - useCustomersQuery(q), useCustomerQuery(id), useCustomerDriversQuery(id) — no agencyId
- `src/features/customers/queries.test.tsx` - hook tests incl. the org-scoping invariant test
- `src/shared/i18n/fr/common.json` / `src/shared/i18n/en/common.json` - full `customers.*` namespace + `customerCount_one/_other`

## Decisions Made

- Kept `hasOrgRole` fully additive — did not touch or repurpose `canOperate`/`canRead`/`canManage`, which remain the correct gate for agency-scoped resources (fleet). Doc comments on both sides cross-reference the distinction so a future reader doesn't conflate the two axes.
- Chose 400 (not 404) for `POST /customers/:id/drivers` on an unknown parent customer in the MSW mock, matching the backend's actual `ErrNotFound`→`ErrInvalid` mapping in `service.go` rather than a naively "more RESTful" 404 — this keeps the mock honest for later plans that test the create-then-attach failure path.
- Query keys use `{ q }` as an object (not a bare string) for the list key, mirroring fleet's `{ agencyId, status }` object-key convention for consistency across the codebase's TanStack Query usage.

## Deviations from Plan

None — plan executed exactly as written. Task 3 was formally `tdd="true"`; implementation (`api.ts`/`queries.ts`) and its test file were authored together as a direct, well-specified port of the already-proven fleet pattern rather than as a strict RED-before-GREEN sequence — there was no design uncertainty to de-risk via a first failing test. All specified behavior (org-scoping invariant included) is covered and green.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 03-02 (list), 03-03 (create form), 03-04 (detail) can now compose purely from `src/types/customer.ts`, `hasOrgRole`, the MSW handlers/fixtures, `src/features/customers/{api,queries}.ts`, and the `customers.*` i18n namespace — no further data/contract/permission work needed before those plans.
- Full unit suite (133 tests across 18 files) and `tsc --noEmit` are green with this plan's changes included.
- Flag for 03-02/03-03: the create-then-attach mutation (create customer, then sequentially POST drivers) is intentionally NOT in this plan's `queries.ts` — it belongs in 03-03's `mutations.ts` per the plan's own scope boundary.

---
*Phase: 03-clients*
*Completed: 2026-07-28*
