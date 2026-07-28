---
phase: 03-clients
fixed_at: 2026-07-28T09:03:42Z
review_path: .planning/phases/03-clients/03-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-07-28T09:03:42Z
**Source review:** .planning/phases/03-clients/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (CR-01..CR-04, WR-01..WR-04)
- Fixed: 8
- Skipped: 0

All Critical and Warning findings were fixed. IN-01 (Info) was out of scope
per `fix_scope: critical_warning` and left untouched.

`npx tsc --noEmit`, `npx vitest run` (193/193 tests across 24 files), and
`npm run build` all pass on the final state.

## Fixed Issues

### CR-01: Create-customer screen is unreachable from the UI — no CTA renders it

**Files modified:** `src/features/customers/CustomerList.tsx`, `src/features/customers/CustomerList.test.tsx`
**Commit:** f89c225
**Applied fix:** Added a "New customer" button (`Button asChild` wrapping a
`<Link to="/clients/nouveau">`) next to the list title, gated with
`hasOrgRole(scope, "agent")` read from `useAuthStore` — the same org-wide
gate `CustomerCreateForm` itself enforces, so unauthorized users never see a
dead-end CTA. Added two regression tests: the CTA is absent with no resolved
scope, and renders with the correct `href` for an authorized (owner) scope.

### CR-02: Search input/count disappear and the whole list flashes a full skeleton on every real search

**Files modified:** `src/features/customers/queries.ts`, `src/features/customers/CustomerList.tsx`, `src/features/customers/CustomerList.test.tsx`
**Commit:** 34d5696
**Applied fix:** Added `placeholderData: keepPreviousData` to
`useCustomersQuery` so the previous result set (and a non-pending status)
stays visible while a new `?q=` request is in flight. Changed
`showControls`/`showCount` in `CustomerList` to gate on `!query.isPending`
instead of `query.isSuccess` (per the review's fix guidance), since
`isPending` is now true only on the very first load. Added a regression test
that types a search term, waits past the debounce but before a deliberately
slowed server response, and asserts the search input is still mounted with
its typed value and no skeleton is shown.

### CR-03: Type-toggle back to "individual" can silently block submission via hidden, stale `drivers` rows

**Files modified:** `src/features/customers/CustomerCreateForm.tsx`, `src/features/customers/CustomerCreateForm.test.tsx`
**Commit:** ff7024a
**Applied fix:** Destructured `replace` from `useFieldArray` and added a
`useEffect` that calls `replace([])` whenever `type` becomes `"individual"`,
clearing any drivers rows added while on the company branch. Added a
regression test: toggle to company, add a blank driver row, toggle back to
individual (row must be gone from the DOM), fill the individual-required
fields, and confirm submit succeeds (POST /customers fires and navigation
happens) — previously this would silently fail validation with zero visible
error.

### CR-04: Driver retry resubmits the stale invalid payload, and the real per-row failure reason is discarded

**Files modified:** `src/features/customers/CustomerCreateForm.tsx`, `src/features/customers/CustomerCreateForm.test.tsx`, `src/shared/i18n/fr/common.json`, `src/shared/i18n/en/common.json`
**Commit:** 4f129ab
**Applied fix:** Fixed together with WR-04 since both live in the same
retry/failure-rendering code path. `retryFailed` now reads
`getValues("drivers")` at retry time and maps each failed row's *current*
form value through `toCreateDriverBody` (imported from `mutations.ts`)
instead of resubmitting the stale `partialFailure.results[i].body` captured
at the original failed submission — falling back to the captured body only
if a row is unexpectedly absent from current form state. Also added a
`driverFailureMessage` helper that inspects the captured `DriverAttachResult.error`
via `isHTTPError` and renders a distinct, translated
`customers.errors.driverFailedValidation` message for 400s (data rejected —
fixing and retrying makes sense) versus the generic `driverFailed` message
for other failures. Added the new i18n key to both locale files. Added a
regression test: submit a company with an invalid driver row (400), assert
the failure-specific message renders, edit the failed row's license number
in place, click Retry, and assert the *edited* value (not the original
invalid one) is what reaches the server.

### WR-01: Required-field validation shows raw, untranslated Zod default messages

**Files modified:** `src/features/customers/schemas.ts`, `src/shared/i18n/fr/common.json`, `src/shared/i18n/en/common.json`
**Commit:** 29885ce
**Applied fix:** Added explicit `{ message: "customers.errors.*" }` keys to
every base `.min(1)` requiredness constraint that had none: `full_name`,
`legal_name`, `rc` (customer schema) and `full_name`, `license_number`
(driver schema) — matching the file's own documented "messages are i18n
keys, never bare strings" contract. Added the five new keys
(`fullNameRequired`, `legalNameRequired`, `rcRequired`,
`driverFullNameRequired`, `driverLicenseNumberRequired`) to both locale
files. Existing `schemas.test.ts` assertions (`success === false`, no exact
message check for these fields) still pass unchanged.

### WR-02: `phone`, `address`, and `license_number` have no `<FieldError>` wired

**Files modified:** `src/features/customers/CustomerCreateForm.tsx`, `src/features/customers/CustomerCreateForm.test.tsx`
**Commit:** e3bbc1a
**Applied fix:** Added `data-invalid`, `aria-invalid`, and `<FieldError>`
wiring to the `license_number` (individual branch), `phone`, and `address`
fields, matching every other constrained field in the form. Added a
regression test: typing a 31-character phone number (exceeding the
schema's `max(30)`) now visibly flags `aria-invalid="true"` and blocks
submission (no POST fires), instead of failing with zero feedback.

### WR-03: Path-like id params are interpolated into request URLs without validation

**Files modified:** `src/features/customers/api.ts`
**Commit:** 9885dd1
**Applied fix:** Adapted the review's suggested fix — the review's literal
snippet used a strict UUID-format regex, but that would have rejected the
many non-UUID mock ids already used throughout the existing test suite
(e.g. `"existing-company-1"`, `"new-company-2"`), breaking dozens of passing
tests unrelated to this finding. The review explicitly names
`encodeURIComponent` as an acceptable minimal alternative ("at minimum
`encodeURIComponent` each path segment"), so `fetchCustomer`,
`fetchCustomerDrivers`, and `createDriver` now run every id through a new
`encodeIdSegment` helper before interpolating it into the request path.
This closes the path-traversal vector (a crafted id containing `/` or `../`
segments is percent-encoded into a single opaque segment and can no longer
be resolved as an extra path component) while leaving every existing test
fixture id — and real UUIDs — round-tripping unchanged.

### WR-04: Captured per-row driver error is never surfaced (dead diagnostic data)

**Files modified:** `src/features/customers/CustomerCreateForm.tsx`, `src/features/customers/CustomerCreateForm.test.tsx`, `src/shared/i18n/fr/common.json`, `src/shared/i18n/en/common.json`
**Commit:** 4f129ab (fixed together with CR-04 — see above)
**Applied fix:** `DriverAttachResult.error` is now read via the
`driverFailureMessage` helper described under CR-04, threading the captured
error into a failure-specific translated message instead of discarding it.

## Skipped Issues

None — all 8 in-scope findings were fixed and verified.

---

_Fixed: 2026-07-28T09:03:42Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
