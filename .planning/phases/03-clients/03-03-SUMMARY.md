---
phase: 03-clients
plan: 03
subsystem: ui
tags: [react, react-hook-form, zod, radix-ui, tanstack-router, tanstack-query, msw, i18n, customer]

requires:
  - phase: 03-clients
    plan: 01
    provides: "src/types/customer.ts DTO mirror, hasOrgRole org-wide gate, MSW customer/driver handlers+fixtures, src/features/customers/{api,queries}.ts, customers.* i18n namespace"
  - phase: 03-clients
    plan: 02
    provides: "src/routes/_authenticated/clients/$customerId.tsx typed stub (this plan's own navigation target, pulled forward by 03-02), /clients real route directory"
provides:
  - "src/shared/ui/radio-group.tsx — accessible radiogroup primitive (radix-ui, mirrors select.tsx/button.tsx authoring pattern)"
  - "src/features/customers/schemas.ts — customerSchema (Zod discriminatedUnion individual|company + cinRequired/licenseDateOrder refines) and driverSchema, encoding DOMAIN requiredness not the loose DTO omitempty tags"
  - "src/features/customers/mutations.ts — useCreateCustomerMutation (create-then-attach, sequential driver POSTs, honest partial-failure result) + useAttachDriversMutation (retry failed rows against an existing customer id, never re-creates the customer)"
  - "src/features/customers/CustomerCreateForm.tsx — the real /clients/nouveau screen: type-toggle radiogroup, per-type field sets, drivers useFieldArray sub-form, partial-failure banner + retry, hasOrgRole(scope,\"agent\") gate"
  - "src/routes/_authenticated/clients/nouveau.tsx — real create route"
  - "customers.create.notAuthorizedHeading/Body i18n keys (FR+EN) for the org-role gate's EmptyState"
affects: [03-04]

tech-stack:
  added: []
  patterns:
    - "zodResolver cast to a flat RHF-friendly interface (CustomerFormValues) distinct from the schema's true discriminated-union inferred output type — documented in schemas.ts, applied in CustomerCreateForm.tsx — so RHF's Path<T>/register() typing resolves cleanly for a single toggled form while the runtime validation still runs the real union + refines"
    - "translatedError(t, fieldError) helper resolves i18n-key Zod messages through t() before handing them to shadcn's FieldError, which otherwise renders error.message verbatim — first form in the codebase whose schema messages are keys rather than bare strings"
    - "create-then-attach with an explicit partial-failure discriminated result (DriverAttachResult[] with index/body/success/error) instead of throwing on a mid-sequence failure — the created customer is never rolled back and the caller can retry only the failed rows"
    - "onSubmit early-returns when a partialFailure state already exists (defense against Enter-key resubmission), and the main submit button is replaced (not merely disabled) by the retry banner once a customer exists — the only way to POST /customers again is a fresh mount"

key-files:
  created:
    - src/shared/ui/radio-group.tsx
    - src/features/customers/schemas.ts
    - src/features/customers/schemas.test.ts
    - src/features/customers/mutations.ts
    - src/features/customers/mutations.test.tsx
    - src/features/customers/CustomerCreateForm.tsx
    - src/features/customers/CustomerCreateForm.test.tsx
    - src/routes/_authenticated/clients/nouveau.tsx
  modified:
    - src/shared/i18n/fr/common.json
    - src/shared/i18n/en/common.json

key-decisions:
  - "License fields (license_number/license_issued_at/license_valid_until) render only in the individual branch's UI, not the company branch — a company entity has no personal driving license, only its drivers do (each driver row carries its own license fields via driverSchema); the Zod schema still spreads licenseDates onto both object shapes for type uniformity, but the component only surfaces them where domain-meaningful"
  - "Radix RadioGroup and Select are wired via react-hook-form's Controller (value/onValueChange), not register() — neither is a native form control the way Input is, so register()'s ref-based approach doesn't apply"
  - "Partial-failure retry re-attaches ONLY the previously-failed rows (not the whole driver list) against the existing customer id, and on a still-partial retry outcome the banner re-renders with the new (smaller) failed set rather than merging index histories — simplest state shape that still lets the user retry to completion"
  - "Added customers.create.notAuthorizedHeading/Body (FR+EN) — the plan's hasOrgRole gate needed a genuine i18n key, not a bare EmptyState default, since D-06 forbids literal copy anywhere in a customer-facing screen"

requirements-completed: [CUST-01, CUST-02]

coverage:
  - id: D1
    description: "customerSchema Zod discriminated union (individual|company) with cinRequired and licenseDateOrder refines, encoding DOMAIN requiredness not the DTO's loose omitempty tags; driverSchema with its own requiredness + date-order refine"
    requirement: "CUST-01"
    verification:
      - kind: unit
        ref: "src/features/customers/schemas.test.ts (17 tests, all behavior-block cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "radio-group.tsx accessible primitive (radix-ui RadioGroup.Root/Item, data-slot styling hooks matching select.tsx/button.tsx)"
    requirement: "CUST-01"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (compiles; exercised live by CustomerCreateForm.test.tsx's radiogroup assertions)"
        status: pass
    human_judgment: false
  - id: D3
    description: "useCreateCustomerMutation: create-then-attach, sequential (not Promise.all) driver POSTs, zero-driver/individual skip attachment, partial failure preserves the created customer and reports succeeded/failed rows, full success invalidates ['customers']"
    requirement: "CUST-02"
    verification:
      - kind: unit
        ref: "src/features/customers/mutations.test.tsx (8 tests covering every behavior-block case incl. sequential-order and non-invalidation-on-partial-failure)"
        status: pass
    human_judgment: false
  - id: D4
    description: "useAttachDriversMutation: retries only the given failed rows against an existing customer id, never re-POSTs /customers, invalidates ['customers'] once the retried rows fully succeed"
    requirement: "CUST-02"
    verification:
      - kind: unit
        ref: "src/features/customers/mutations.test.tsx#useAttachDriversMutation (retry failed rows)"
        status: pass
    human_judgment: false
  - id: D5
    description: "CustomerCreateForm: type-toggle radiogroup default individual, swaps to company field set (legal_name/rc/nif/nis + drivers sub-form), hides identity-doc fields on company"
    requirement: "CUST-01"
    verification:
      - kind: unit
        ref: "src/features/customers/CustomerCreateForm.test.tsx (type toggle describe block, 2 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Individual create: cin-required blocks submit with no request when cin+empty number; happy path POSTs /customers and navigates to /clients/$customerId"
    requirement: "CUST-01"
    verification:
      - kind: unit
        ref: "src/features/customers/CustomerCreateForm.test.tsx (individual describe block, 2 tests)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Company create-then-attach: 2-driver happy path POSTs /customers then 2 sequential driver POSTs and navigates; drivers add/remove via field.id keys does not corrupt row state on a middle-row removal; zero-driver company creates without attempting a driver POST"
    requirement: "CUST-02"
    verification:
      - kind: unit
        ref: "src/features/customers/CustomerCreateForm.test.tsx (company + drivers describe block, 3 of 4 tests)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Driver partial failure: customer created, 2nd driver POST 400s — UI names the failed driver via partialSuccess/driverFailed copy, replaces the submit button with a retry action, and retry re-attaches only the failed row against the existing customer id with exactly ONE POST /customers across the whole flow"
    requirement: "CUST-02"
    verification:
      - kind: unit
        ref: "src/features/customers/CustomerCreateForm.test.tsx#partial failure ... retry does NOT re-POST /customers"
        status: pass
    human_judgment: false
  - id: D9
    description: "Screen gated with hasOrgRole(scope,\"agent\") (org-wide axis, T-03-07) — renders an EmptyState with the new notAuthorized i18n copy when absent"
    requirement: "CUST-01"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit + npm run build (compiles; every CustomerCreateForm.test.tsx mount uses an authorized owner scope, so the gate's positive path is exercised on every test, but the negative/unauthorized branch has no dedicated assertion)"
        status: pass
    human_judgment: true
    rationale: "No test explicitly asserts the unauthorized EmptyState branch renders when hasOrgRole is false — the gate's negative path is implemented and type-checks but not directly unit-tested; flagging for a human/verifier pass rather than claiming full automated coverage."
---

# Phase 3 Plan 3: Customer Create Form (Individual/Company + Drivers) Summary

**Single `/clients/nouveau` form with a radiogroup individual↔company toggle, Zod discriminated-union validation (domain requiredness, not DTO omitempty), and a create-then-attach mutation that surfaces partial driver-attachment failure honestly with a no-double-POST retry.**

## Performance

- **Duration:** ~15 min (across the full plan, incl. the continuation)
- **Started:** 2026-07-28T08:05:38Z (Task 1 commit)
- **Completed:** 2026-07-28T08:20:38Z (Task 3 commit)
- **Tasks:** 3
- **Files modified:** 10 (8 created, 2 modified)

## Accomplishments

- Hand-authored `radio-group.tsx` from the unified `radix-ui` package (Task 1), matching the existing `select.tsx`/`button.tsx` authoring convention — no new package installs.
- Built `customerSchema` as a Zod `discriminatedUnion("type", [individual, company])` with two cross-field `.refine`s (`cinRequired` on `identity_doc_number` when `identity_doc_type==="cin"`, `licenseDateOrder` on `license_valid_until`), encoding the DOMAIN requiredness from `customer.go` rather than the loose transport-layer `omitempty` tags — plus a standalone `driverSchema` with its own requiredness and date-order refine. No format regex on CIN/RC/NIF/NIS/license, matching the backend's own lack of one (D-09).
- Built `useCreateCustomerMutation` (create-then-attach: `POST /customers` then sequential `for…await` `POST /customers/:id/drivers`, never `Promise.all`) returning an explicit `CreateCustomerResult { customer, driverResults }` so a mid-sequence driver failure never rolls back the already-persisted customer, and `useAttachDriversMutation` for retrying only the failed rows against an existing customer id.
- Built `CustomerCreateForm.tsx`: one form, a `RadioGroup`-driven type toggle (individual default), per-type field sets (individual: full_name + identity doc + own license; company: legal_name/rc/nif/nis + a `useFieldArray("drivers")` sub-form keyed by `field.id`), a `translatedError()` helper that resolves the schema's i18n-key Zod messages through `t()` before they reach `FieldError`, and a partial-failure banner (naming each failed driver by name) with a retry button that calls `useAttachDriversMutation` — `onSubmit` guards against ever re-POSTing `/customers` once a customer exists in this session.
- Wired `/clients/nouveau`; gated the screen with `hasOrgRole(scope, "agent")` (org-wide axis, T-03-07), adding the two missing `customers.create.notAuthorized*` i18n keys the gate needed.

## Task Commits

Each task was committed atomically:

1. **Task 1: radio-group primitive + Zod discriminated-union schema (individual|company) + driver schema** - `b99828f` (feat)
2. **Task 2: create-then-attach mutation with honest partial-failure semantics** - `3a316aa` (feat)
3. **Task 3: CustomerCreateForm (type toggle + drivers field array + partial-failure UI) + routes** - `ae1797b` (feat)

## Files Created/Modified

- `src/shared/ui/radio-group.tsx` - accessible radiogroup primitive (radix-ui)
- `src/features/customers/schemas.ts` - customerSchema (discriminated union + 2 refines) + driverSchema + CustomerFormValues (flat RHF-friendly type)
- `src/features/customers/schemas.test.ts` - 17 tests covering every behavior-block case
- `src/features/customers/mutations.ts` - useCreateCustomerMutation (create-then-attach) + useAttachDriversMutation (retry) + toCreateCustomerBody/toCreateDriverBody mappers
- `src/features/customers/mutations.test.tsx` - 8 tests covering the full create-then-attach + retry contract
- `src/features/customers/CustomerCreateForm.tsx` - the real /clients/nouveau screen
- `src/features/customers/CustomerCreateForm.test.tsx` - 8 tests covering type toggle, individual/company happy paths, cin-required, drivers add/remove, and partial-failure retry
- `src/routes/_authenticated/clients/nouveau.tsx` - real create route (no loader)
- `src/shared/i18n/fr/common.json` / `src/shared/i18n/en/common.json` - added `customers.create.notAuthorizedHeading`/`notAuthorizedBody`

## Decisions Made

- License fields render only in the individual branch's UI (a company itself has no personal license; only its drivers do, via their own driverSchema-backed rows) — the Zod schema spreads `licenseDates` onto both object shapes for type uniformity, but the component surfaces them only where domain-meaningful.
- Radix `RadioGroup`/`Select` are wired via react-hook-form's `Controller` (`value`/`onValueChange`), not `register()` — neither renders a native form control the way `Input` does.
- Partial-failure retry re-attaches only the previously-failed rows against the existing customer id; a still-partial retry outcome re-renders the banner with the new (smaller) failed set rather than reconciling against the original index history — the simplest state shape that still lets the user retry to completion.
- Added `customers.create.notAuthorizedHeading`/`notAuthorizedBody` (FR+EN) for the `hasOrgRole` gate's `EmptyState` — the plan required gating the screen but no i18n copy existed for the negative branch; D-06 forbids bare literals anywhere in the form.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Added a `translatedError()` helper to resolve i18n-key Zod messages before rendering**
- **Found during:** Task 3, first test run (`cin-required` test failing — the DOM showed the raw key `customers.errors.cinRequired`, not the translated French copy)
- **Issue:** `schemas.ts`'s Zod refines set `message` to i18n KEYS (`customers.errors.cinRequired`, `customers.errors.licenseDateOrder`), matching the plan's own stated contract ("Validation messages are i18n keys resolved via `t()` at render"). shadcn's `FieldError` component renders `error.message` verbatim with no translation step — every other form in the codebase (LoginForm/SignupForm) uses Zod's own default English messages, so this gap had no prior precedent to copy.
- **Fix:** Added a module-level `translatedError(t, fieldError)` helper that maps `{ message: t(error.message) }` before handing the array to `FieldError`; applied it at all 7 field-error call sites (full_name, identity_doc_number, license_valid_until, legal_name, rc, and both driver-row fields).
- **Files modified:** `src/features/customers/CustomerCreateForm.tsx`
- **Verification:** `cin-required` test (and the license-date-order path it shares logic with) now asserts the translated French copy renders; full suite green.
- **Committed in:** `ae1797b` (Task 3 commit)

**2. [Rule 2 - Missing critical] Added `customers.create.notAuthorizedHeading`/`notAuthorizedBody` i18n keys**
- **Found during:** Task 3, implementing the plan's own instruction to gate the screen with `hasOrgRole(scope, "agent")`
- **Issue:** The plan requires a "not-authorized state" for users lacking the org role, but no i18n key existed for that copy (the `customers.*` namespace from 03-01 covers list/create/drivers/errors/detail, not an org-gate denial message) — D-06 forbids bare-literal copy.
- **Fix:** Added `customers.create.notAuthorizedHeading`/`notAuthorizedBody` to both `fr/common.json` and `en/common.json`, reused via the shared `EmptyState` component (mirrors the existing `titleKey`/`descriptionKey` pattern).
- **Files modified:** `src/shared/i18n/fr/common.json`, `src/shared/i18n/en/common.json`
- **Verification:** `npx tsc --noEmit` clean; i18n FR/EN key-parity test (`src/shared/i18n/i18n.test.ts`) still green.
- **Committed in:** `ae1797b` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 2 — missing critical i18n/translation plumbing the plan's own text required but didn't fully spell out the mechanism for).
**Impact on plan:** Both fixes are strictly additive plumbing required to satisfy the plan's own stated i18n contract (D-06, "no bare literals"). No scope creep, no architectural change.

## Issues Encountered

- The first CustomerCreateForm.test.tsx run failed all 8 tests with raw i18n keys (`customers.create.title`, etc.) rendering instead of translated copy — root cause was a missing `import i18n from "@/shared/i18n"` side-effect import in the test file itself (i18next is a lazy singleton; nothing else in the CustomerCreateForm import chain triggers `.init()`). Fixed by adding the same `import i18n from "@/shared/i18n"` + `afterEach(() => i18n.changeLanguage("fr"))` pattern already established in `CustomerList.test.tsx`/`VehicleDetail.test.tsx`. Test-only fix, no production code change.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 03-04 (customer detail) can now compose `useCustomerQuery`/`useCustomerDriversQuery` (03-01) into the real `$customerId` route, replacing the `EmptyState` stub that both 03-02 and this plan's navigation target rely on.
- Full unit suite (179 tests across 23 files), `npx tsc --noEmit`, and `npm run build` are all green with this plan's changes included.
- Flag for the verifier/UAT pass: the `hasOrgRole` negative (unauthorized) branch of `CustomerCreateForm` is implemented and type-checks but has no dedicated unit test asserting the `EmptyState` renders for a non-agent scope (see coverage D9) — worth a manual check or a follow-up test before closing CUST-01 fully.

---
*Phase: 03-clients*
*Completed: 2026-07-28*

## Self-Check: PASSED

All 8 declared key-files found on disk; all 3 commit hashes (`b99828f`, `3a316aa`, `ae1797b`) verified present in `git log --oneline --all`.
