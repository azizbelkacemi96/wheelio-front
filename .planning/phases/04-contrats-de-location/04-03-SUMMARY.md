---
phase: 04-contrats-de-location
plan: 03
subsystem: contracts-detail-lifecycle
status: complete
tags: [rentals, react-hook-form, zod, tanstack-query, i18n, rbac, tdd]
requires:
  - features/contracts (useContractQuery, useActivate/useClose/useCancel/useRecordDeposit, transitionErrorKey — 04-01)
  - features/fleet (useVehicleQuery — plate + agency gate)
  - features/customers (useCustomerQuery — name)
  - shared/auth/permissions (canOperate)
  - shared/ui (Field/FieldError/Select/Input/Card/Button)
provides:
  - src/features/contracts/schemas.ts (activateSchema, closeSchema, cancelSchema, depositSchema, lineSchema; toActivateBody, toCloseBody, toDepositBody)
  - src/features/contracts/forms/ActivateForm.tsx
  - src/features/contracts/forms/CloseForm.tsx (useFieldArray invoice lines)
  - src/features/contracts/forms/CancelForm.tsx
  - src/features/contracts/forms/DepositForm.tsx
  - src/features/contracts/forms/formHelpers.ts (FUEL_LEVELS, translatedError)
  - src/features/contracts/ContractDetail.tsx
  - filled /contrats/$contractId route
  - useVehicleQuery/useCustomerQuery optional `{ enabled }` gate
affects: [04-04, 04-05, 04-06]
tech-stack:
  added: []
  patterns: [enabled-gated dependent queries, useFieldArray sub-form, DZD->integer-cents mapper, 409 re-gate via detail invalidation, resolver cast for zod coerce]
key-files:
  created:
    - src/features/contracts/schemas.ts
    - src/features/contracts/schemas.test.ts
    - src/features/contracts/forms/ActivateForm.tsx
    - src/features/contracts/forms/CloseForm.tsx
    - src/features/contracts/forms/CancelForm.tsx
    - src/features/contracts/forms/DepositForm.tsx
    - src/features/contracts/forms/formHelpers.ts
    - src/features/contracts/forms/forms.test.tsx
    - src/features/contracts/ContractDetail.tsx
    - src/features/contracts/ContractDetail.test.tsx
  modified:
    - src/routes/_authenticated/contrats/$contractId.tsx
    - src/features/fleet/queries.ts
    - src/features/customers/queries.ts
    - src/shared/i18n/fr/common.json
    - src/shared/i18n/en/common.json
decisions:
  - "Dependent vehicle/customer queries gated via an optional `{ enabled }` param added to useVehicleQuery/useCustomerQuery (backward-compatible, default true) rather than a blind fetch('') or a waterfall"
  - "zod `coerce` widens the resolver input type to unknown; forms cast zodResolver to the parsed-output Resolver (the CustomerCreateForm idiom) — runtime coercion + validation intact"
  - "Record-deposit action implemented fully (depositSchema + DepositForm) rather than stubbed, since D-03 says the detail exposes the deposit"
  - "Cancel reason uses a styled native <textarea> (no textarea primitive is vendored); submit label is a distinct contracts.forms.cancelSubmit to disambiguate from the Cancel action button"
metrics:
  duration: ~35m
  tasks: 2
  files_created: 10
  files_modified: 5
  tests_added: 23
  completed: 2026-07-29
---

# Phase 4 Plan 03: Contract Detail + Lifecycle Forms Summary

The `/contrats/$contractId` detail screen plus the three status-gated lifecycle actions — Activate (departure mileage+fuel, RENT-02), Close (return mileage+fuel + ≥1 invoice line, RENT-03), Cancel (reason, RENT-04) — and their zod schemas. The screen resolves plate + customer name (and the `canOperate` agency gate) from separate vehicle/customer fetches because `contractResponse` carries only UUIDs and no `agency_id`. Button visibility mirrors the backend transition matrix AND the agency axis; a stale-UI 409 shows its distinct message and refetches to re-gate.

## What was built

- **`schemas.ts`** — `activateSchema` (mileage coerced int gte 0, fuel enum, actual_at optional), `closeSchema` (mileage+fuel + `invoice_lines` min 1, each line description/quantity gt 0/amount_dzd/vat_rate int), `cancelSchema` (trimmed non-empty reason), `depositSchema` (amount_dzd gt 0 + method). Mappers `toActivateBody`, `toCloseBody` (DZD→`unit_price_ht_cents` via `Math.round(amount_dzd*100)` — integer cents, vat_rate as-is), `toDepositBody`. All messages are i18n KEYS.
- **Three lifecycle forms + a deposit form** under `forms/` — react-hook-form + zodResolver + shared Field/FieldError/Select primitives. `CloseForm` uses `useFieldArray` keyed by `field.id` for the repeatable invoice lines (add/remove, required first row). Each lifecycle form's catch maps a 409 via `transitionErrorKey(kind, error)` to the DISTINCT message AND invalidates `['contracts','detail',id]` to force a re-gate; non-409 shows the generic per-action key. `formHelpers.ts` holds `FUEL_LEVELS` + `translatedError`.
- **`ContractDetail.tsx`** — composes `useContractQuery` then `useVehicleQuery`/`useCustomerQuery` gated on the loaded contract (`enabled: !!contract`), independent errors stay inline. Resolves the card (vehicle plate+brand/model, customer name, period, status badge, deposit in DZD, departure/return mileage+fuel, cancel reason — all presence-guarded). Action buttons gated on `mayOperate = scope != null && vehicle !== undefined && canOperate(scope, vehicle.agency_id)` (agency read off the VEHICLE, not the contract) AND the transition matrix (reserved→Activate/Cancel; active→Close/Cancel; closed/cancelled→none). A 404 renders one generic not-found state.
- **`$contractId` route** filled (replaces the 04-02 EmptyState stub), mirroring `clients/$customerId.tsx`.
- **Query hooks** `useVehicleQuery`/`useCustomerQuery` gained an optional `{ enabled }` (default true) so a dependent caller can gate on parent data without firing `fetch('')`.
- **i18n** — added `contracts.forms.*` (invoice-line labels, cancel reason/submit), `contracts.errors.*` field messages (mileageInvalid/fuelRequired/descriptionRequired/quantityInvalid/amountInvalid/vatInvalid/recordDepositFailed), and `contracts.detail.{infoTitle,actionsTitle,vehicleUnavailable,customerUnavailable}` in FR+EN (263/263 keys, identical sets).

## Deviations from Plan

### Auto-fixed / adjustments (Rule 3 — supporting infrastructure)

**1. [Rule 3 - Blocking] Added `{ enabled }` to useVehicleQuery/useCustomerQuery**
- **Why:** the plan requires the vehicle/customer queries to be "enabled once contract data exists" (no waterfall, no blind `fetch('')`), but the 03-01/02-01 hooks had no gating option. Added an optional, backward-compatible `{ enabled }` param defaulting to `true` — existing callers (VehicleDetail, CustomerDetail) are unchanged.
- **Files:** src/features/fleet/queries.ts, src/features/customers/queries.ts
- **Commit:** eb59ac5

**2. [Rule 3 - Blocking] Cast zodResolver for coerce-widened input type**
- **Why:** `z.coerce.number()` widens the schema INPUT type to `unknown`, so `zodResolver(schema)` isn't assignable to `Resolver<OutputValues>` and `tsc` failed. Applied the established CustomerCreateForm idiom — `zodResolver(schema) as unknown as Resolver<FormValues>` — which keeps runtime coercion + validation while relaxing only compile-time field typing.
- **Files:** ActivateForm.tsx, CloseForm.tsx, DepositForm.tsx
- **Commit:** 6871e56, eb59ac5

**3. [Rule 2 - Completeness] Record-deposit implemented fully, not stubbed**
- **Why:** D-03 says the detail exposes the deposit and the plan lists record-deposit as an (optional) action. Rather than leave a dead button, added `depositSchema`/`toDepositBody` + a minimal `DepositForm` wired via `useRecordDeposit`, gated identically (mayOperate + status reserved|active).
- **Files:** schemas.ts, forms/DepositForm.tsx, ContractDetail.tsx
- **Commit:** eb59ac5

No architectural deviations (Rule 4), no auth gates.

## Threat mitigations applied

- **T-04-01 (EoP):** action buttons gated on `canOperate(scope, vehicle.agency_id)` — the correct agency axis; a no-membership scope hides every action even on a reserved contract (under test).
- **T-04-05 (Tampering, stale UI):** a lifecycle 409 shows its distinct `transitionErrorKey` message and invalidates the contract detail to re-gate (under test for activate).
- **T-04-07 (Info disclosure):** one generic not-found state for both nonexistent and out-of-scope contracts (under test).
- **T-04-04 (Info disclosure):** form/field errors map to i18n keys via `translatedError`; raw problem detail never reaches the DOM.

## Verification

- `npx tsc --noEmit` — clean.
- `npm run build` — built in ~291ms, no errors.
- `npx vitest run` — 33 files, 269 tests passed (was 246; +23: schemas 13, forms 3, detail 7).
- `npx vitest run src/features/contracts` — 9 files, 67 passed.
- i18n FR/EN parity — 263/263 keys, identical sets.
- `agency_id` is read only from the vehicle, never from the contract.

## TDD Gate Compliance

- Task 1 followed RED (schemas.test.ts + forms.test.tsx written, observed failing — modules absent, commit 716c608) then GREEN (implementation, commit 6871e56). Explicit `test(...)` → `feat(...)` gate pair present in git history.
- Task 2 (`type="auto"`, not TDD-marked) shipped ContractDetail + its test together (eb59ac5); the test spec was authored to the plan's enumerated cases and observed green.

## Known Stubs

None — every action button is wired to a real, MSW-backed mutation and covered by tests. The record-deposit action was implemented rather than stubbed.

## Self-Check: PASSED

- All 10 created artifacts exist on disk (schemas, four forms, formHelpers, two test files, ContractDetail + its test).
- Commits 716c608 (RED), 6871e56 (Task 1 GREEN), eb59ac5 (Task 2) present in git history.
