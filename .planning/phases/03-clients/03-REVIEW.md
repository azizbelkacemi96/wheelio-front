---
phase: 03-clients
reviewed: 2026-07-28T00:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - e2e/auth.spec.ts
  - src/app/router.test.tsx
  - src/features/customers/CustomerCreateForm.test.tsx
  - src/features/customers/CustomerCreateForm.tsx
  - src/features/customers/CustomerDetail.test.tsx
  - src/features/customers/CustomerDetail.tsx
  - src/features/customers/CustomerList.test.tsx
  - src/features/customers/CustomerList.tsx
  - src/features/customers/CustomerTypeBadge.test.tsx
  - src/features/customers/CustomerTypeBadge.tsx
  - src/features/customers/api.ts
  - src/features/customers/mutations.test.tsx
  - src/features/customers/mutations.ts
  - src/features/customers/queries.test.tsx
  - src/features/customers/queries.ts
  - src/features/customers/schemas.test.ts
  - src/features/customers/schemas.ts
  - src/routes/_authenticated/clients/$customerId.tsx
  - src/routes/_authenticated/clients/index.tsx
  - src/routes/_authenticated/clients/nouveau.tsx
  - src/routes/_authenticated/placeholders.test.tsx
  - src/shared/auth/permissions.test.ts
  - src/shared/auth/permissions.ts
  - src/shared/i18n/en/common.json
  - src/shared/i18n/fr/common.json
  - src/shared/ui/radio-group.tsx
  - src/test/fixtures/customers.ts
  - src/test/mocks/handlers.test.ts
  - src/test/mocks/handlers.ts
  - src/types/customer.ts
findings:
  critical: 4
  warning: 4
  info: 1
  total: 9
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-07-28T00:00:00Z
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

The multi-tenant org-scoping story (`hasOrgRole`, `scopeFromMe`, `roleInAgency`) is solid: it correctly mirrors the backend's `Scope` model, guards against prototype-pollution key lookups, and is well covered by `permissions.test.ts`. `schemas.ts`'s discriminated union correctly narrows per customer type and the two cross-field `.refine()`s (cinRequired, licenseDateOrder) behave as documented and tested.

However, four BLOCKER-level defects were found once the actual UI wiring is traced end-to-end rather than read file-by-file: (1) the create-customer screen the phase exists to deliver has **no discoverable navigation path** — the CTA i18n key is defined but never rendered; (2) the server-side search feature silently unmounts its own input and flashes a full-page skeleton on essentially every real search due to a missing `placeholderData`/`keepPreviousData` on `useCustomersQuery`, contradicting the code's own stated "controls stay mounted" invariant; (3) toggling the type radiogroup back to "individual" after touching the (shared, but conditionally-hidden) `drivers` field array can silently block form submission with zero visible error, because the discriminated union validates `drivers` on both branches but only renders its errors on the company branch; (4) the driver-retry flow re-submits the stale, originally-captured (and already-known-invalid) driver payload rather than current form values, so a user "fixing" a failed row and clicking Retry resubmits the identical broken data — compounded by the captured per-row error never being surfaced, only a generic message.

Additional WARNING-level gaps: several optional fields (`phone`, `address`, `license_number`) have length constraints in the schema but no `<FieldError>` wired to display them, so exceeding the limit silently blocks submit; required-field validation messages fall through to Zod's untranslated default strings instead of the app's documented i18n-key contract; and route/user-controlled ids are interpolated unvalidated into request paths.

## Critical Issues

### CR-01: Create-customer screen is unreachable from the UI — no CTA renders it

**File:** `src/features/customers/CustomerList.tsx:77-104`
**Issue:** `customers.create.cta` ("Nouveau client" / "New customer") is defined in both `src/shared/i18n/fr/common.json:156` and `src/shared/i18n/en/common.json:156`, and the route `/clients/nouveau` (`src/routes/_authenticated/clients/nouveau.tsx`) exists and renders `CustomerCreateForm`. But no component in the reviewed file set ever renders a `<Link to="/clients/nouveau">` or button using that key — confirmed by grepping the whole `src/` tree for `clients/nouveau` and `create.cta` outside of generated route files and the i18n JSON itself. `CustomerList` (the natural place for a "New customer" action, mirroring how list screens typically expose creation) has no such affordance. A user can only reach the create form by typing the URL directly. This defeats the stated purpose of the phase (CUST-01/CUST-02 "create customer" flow) — it ships code that is functionally unreachable through normal navigation.
**Fix:**
```tsx
// CustomerList.tsx, in the header, next to the title:
<div className="flex items-center justify-between gap-2">
  <h1 className="font-heading text-xl font-semibold text-foreground">
    {t("customers.title")}
  </h1>
  <Button asChild>
    <Link to="/clients/nouveau">{t("customers.create.cta")}</Link>
  </Button>
</div>
```
Gate the button's visibility with `hasOrgRole(scope, "agent")` to avoid a dead-end click for unauthorized users, matching `CustomerCreateForm`'s own gate.

---

### CR-02: Search input/count disappear and the whole list flashes a full skeleton on every real search

**File:** `src/features/customers/CustomerList.tsx:57-75`, `src/features/customers/queries.ts:25-30`
**Issue:** `useCustomersQuery(q)` uses query key `["customers", "list", { q }]` with no `placeholderData` (e.g. `keepPreviousData`). In TanStack Query v5 (confirmed `5.101.4` in `package.json`), a query key that has never been fetched starts a brand-new observer at `status: 'pending'` with `data: undefined` — it does NOT reuse the previous key's data. Since every distinct debounced search term (`SEARCH_DEBOUNCE_MS = 300`) produces a brand-new `{ q }` key, `query.isSuccess` becomes `false` and `query.isPending` becomes `true` on essentially every completed debounce cycle for a term the user hasn't searched before (i.e. almost always).

`showControls` (line 74) and `showCount` (line 75) both gate on `query.isSuccess`, so the moment the debounce timer fires a *new* search term, `showControls` flips to `false` and the `<Input>` (holding the user's own search text and focus) **unmounts**, replaced by `CustomerListSkeleton` (full-body skeleton, `CustomerListBody` line 115). This directly contradicts the code's own documented invariant at lines 69-73 ("Controls stay mounted whenever a search is active... otherwise typing a zero-result term would unmount the very Input holding that term, stranding the user") — that invariant is written correctly but is defeated by the `query.isSuccess` condition, since `isSearchActive` being `true` does not prevent `showControls` from going `false` while the new request is in flight.
**Fix:** Use `placeholderData: keepPreviousData` so the previous result set (and `isSuccess`) stays true across key changes while the new request resolves in the background:
```ts
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export function useCustomersQuery(q: string) {
  return useQuery({
    queryKey: ["customers", "list", { q }],
    queryFn: () => fetchCustomers(q),
    placeholderData: keepPreviousData,
  });
}
```
Then gate `showControls`/skeleton rendering on `query.isPending` (true only on the very first load) instead of `query.isSuccess`, and optionally use `query.isFetching` for a lightweight in-place loading indicator instead of the full skeleton swap.

---

### CR-03: Type-toggle back to "individual" can silently block submission via hidden, stale `drivers` rows

**File:** `src/features/customers/schemas.ts:52-69`, `src/features/customers/CustomerCreateForm.tsx:107-172`
**Issue:** Both discriminated-union branches (`individual` at line 58, `company` at line 68) declare `drivers: z.array(driverSchema).optional()`. `CustomerCreateFormInner` registers a single `useFieldArray({ control, name: "drivers" })` (line 127) that is never reset or cleared when the user toggles `type` — confirmed no `reset()`/`useEffect` exists anywhere in the file. The drivers sub-form UI is only rendered in the `type === "company"` branch (lines 312-370); when `type === "individual"`, the array's data still exists in RHF state but its fields (and any `<FieldError>` for `drivers.N.*`) are not rendered at all.

Reproduction: toggle to "Entreprise", click "Ajouter un conducteur" (adds a row via `append({ full_name: "", license_number: "" })`, line 365 — a row that fails `driverSchema`'s `.min(1)` on both fields), then toggle back to "Particulier" and fill in the required individual fields. On submit, `customerSchema`'s validation runs against the *individual* branch, which still includes the (still-blank, still-invalid) `drivers` array — the whole parse fails. Since no `drivers.*` field is rendered while `type === "individual"`, the user sees **no error at all**: the submit button click does nothing observable, `isSubmitting` never flips, and there is no way to discover why.
**Fix:** Reset the `drivers` array whenever `type` changes away from `"company"`, e.g.:
```tsx
const type = watch("type");
useEffect(() => {
  if (type === "individual") replace([]);
}, [type, replace]);
```
(`replace` from `useFieldArray`'s return value.) Alternatively, scope the runtime-validated schema per the currently-selected branch only, or add a top-level fallback error surface that renders any `errors.drivers` issues regardless of which branch is active.

---

### CR-04: Driver retry resubmits the stale invalid payload, and the real per-row failure reason is discarded

**File:** `src/features/customers/CustomerCreateForm.tsx:154-170,385-413`, `src/features/customers/mutations.ts:29-35,89-104`
**Issue:** `DriverAttachResult` (mutations.ts:30-35) captures a raw `error?: unknown` per failed row inside `attachDriversSequentially`'s catch block (line 100), but that field is never read anywhere in the reviewed file set — the partial-failure banner (CustomerCreateForm.tsx:393-401) only renders `r.body.full_name` plus the single generic string `t("customers.errors.driverFailed")` ("Impossible d'ajouter ce conducteur.") for every failure, regardless of whether the cause was a validation 400, a duplicate-license conflict, or a transient 500.

More importantly, `retryFailed` (lines 154-170) builds its retry payload from `partialFailure.results.filter((r) => !r.success).map((r) => r.body)` — i.e. the exact `CreateDriverBody` objects captured at the moment of the *original, failed* submission. The driver-row `<Input>`s (lines 325-350) remain fully editable after a partial failure (nothing disables them), giving the user every visual cue that editing a failed row and clicking "Réessayer" will retry the corrected data. It will not: the retry payload is derived solely from the stale `partialFailure.results`, completely ignoring whatever the user typed into the form afterward. For a driver rejected due to a validation error (e.g. license number too long, format the backend rejects), retry is guaranteed to fail identically forever, with no path to actually fix and resubmit that row short of reloading the page and recreating a different customer.
**Fix:** Either (a) read current `getValues("drivers")` for the corresponding rows at retry time instead of the captured `partialFailure.results[i].body`, so edits are respected, or (b) if retry is intentionally meant to replay the exact original payload (e.g. for transient-failure-only retries), disable/lock the failed rows' inputs and surface the captured `error` (or a `response.status`-derived hint) so users understand *why* retrying identical data will not help and know to abandon that row instead. At minimum, wire `r.error` into the displayed message so "Impossible d'ajouter ce conducteur" isn't the only information given for every distinct failure mode.

## Warnings

### WR-01: Required-field validation shows raw, untranslated Zod default messages

**File:** `src/features/customers/schemas.ts:34-35,54,63-64`, `src/features/customers/CustomerCreateForm.tsx:80-85`
**Issue:** `schemas.ts`'s own doc comment (lines 18-21) states: "Validation messages are i18n KEYS (`customers.errors.*`)... never a bare English/French string here." That contract is honored for the two `.refine()`s (`cinRequired`, `licenseDateOrder`) but NOT for the base `.min(1)` requiredness constraints on `full_name` (line 54), `legal_name` (line 63), `rc` (line 64), or `driverSchema`'s `full_name`/`license_number` (lines 34-35) — none of these pass a custom `{ message: "customers.errors.xRequired" }`. `translatedError` (CustomerCreateForm.tsx:80-85) unconditionally calls `t(error.message)` on whatever message the resolver attaches; for these fields that message is Zod v4's built-in English string (e.g. something like "Too small: expected string to have >=1 characters"), which is not a registered i18n key, so `t()` returns it verbatim — raw English text is shown to French-locale users on the single most common validation failure (leaving a required field blank).
**Fix:** Add explicit message keys to every base constraint that can independently fail, e.g.:
```ts
full_name: z.string().min(1, { message: "customers.errors.fullNameRequired" }).max(200),
legal_name: z.string().min(1, { message: "customers.errors.legalNameRequired" }).max(200),
rc: z.string().min(1, { message: "customers.errors.rcRequired" }).max(30),
```
and equivalent entries in `driverSchema`, plus the corresponding `customers.errors.*` keys in both `fr/common.json` and `en/common.json`.

### WR-02: `phone`, `address`, and `license_number` have no `<FieldError>` wired — max-length violations silently block submit

**File:** `src/features/customers/CustomerCreateForm.tsx:262-267,374-381`
**Issue:** `license_number` (individual branch, lines 262-267), `phone` (lines 374-377), and `address` (lines 378-381) are all rendered without `aria-invalid` or a `<FieldError>` sibling, unlike every other constrained field in the form. Their schema constraints (`license_number.max(30)`, `phone.max(30)`, `address.max(300)`) are real and enforced — if a user exceeds them, `handleSubmit` blocks the submit silently (no `onSubmit` invocation, no visible feedback anywhere on the page).
**Fix:** Add `data-invalid`/`aria-invalid`/`<FieldError>` to these three `Field`s consistently with the rest of the form, e.g.:
```tsx
<Field data-invalid={!!errors.phone}>
  <FieldLabel htmlFor="phone">{t("customers.fields.phone")}</FieldLabel>
  <Input id="phone" aria-invalid={!!errors.phone} {...register("phone")} />
  <FieldError errors={translatedError(t, errors.phone)} />
</Field>
```

### WR-03: Path-like id params are interpolated into request URLs without validation

**File:** `src/features/customers/api.ts:22-24,26-28,36-43`
**Issue:** `fetchCustomer(id)`, `fetchCustomerDrivers(id)`, and `createDriver(customerId, body)` interpolate `id`/`customerId` directly into a template-string path (`` `customers/${id}` ``, `` `customers/${customerId}/drivers` ``) passed to `ky`'s relative-path resolution against `prefixUrl`. These ids ultimately originate from a route path param (`Route.useParams().customerId` in `$customerId.tsx`) that a user can set to an arbitrary string via the address bar (e.g. containing `../` segments), with no UUID-format validation before it reaches the request path. Standard URL resolution collapses `../` against the configured base, so a crafted id can redirect the request to an unintended path under the same origin. Backend authorization/RLS still gates the actual response, so this is not a tenant-isolation bypass, but it is an unvalidated-input gap worth closing defensively, especially given the codebase's stated "double barrier" (application + RLS) security posture.
**Fix:** Validate/guard the id shape before use (or at minimum `encodeURIComponent` each path segment), e.g.:
```ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function fetchCustomer(id: string): Promise<CustomerResponse> {
  if (!UUID_RE.test(id)) return Promise.reject(new Error("invalid customer id"));
  return api.get(`customers/${id}`).json<CustomerResponse>();
}
```

### WR-04: Captured per-row driver error is never surfaced (dead diagnostic data)

**File:** `src/features/customers/mutations.ts:29-35,99-101`
**Issue:** `DriverAttachResult.error` is populated in `attachDriversSequentially`'s catch block but is not read by any file in the reviewed set (`CustomerCreateForm.tsx`'s partial-failure UI only uses `r.body.full_name` and a hardcoded i18n key). This is dead data today; it also compounds CR-04 since the one piece of information that would let a user distinguish "your data was invalid" from "the server is down" is captured and then thrown away.
**Fix:** Either remove the field if it's genuinely unneeded, or thread it through to the UI (e.g. via `isHTTPError(r.error) ? r.error.response.status : undefined` to pick a more specific translated message).

## Info

### IN-01: `company` schema branch declares license fields with no corresponding form UI

**File:** `src/features/customers/schemas.ts:61-69`, `src/features/customers/CustomerCreateForm.tsx:287-372`
**Issue:** `company` spreads `licenseDates` (`license_number`, `license_issued_at`, `license_valid_until`, schemas.ts line 67) same as `individual`, but `CustomerCreateForm`'s company branch (lines 287-372) never renders inputs for any of the three — only `legal_name`, `rc`, `nif`, `nis`, and the drivers sub-form are shown. These fields are therefore always `undefined`/`null` for every company customer created through this form; the schema surface is unreachable capability.
**Fix:** Either drop these fields from the `company` schema shape (if companies genuinely never carry a license), or add the corresponding inputs to the company branch if they're meant to be usable — whichever matches the actual backend/domain intent.

---

_Reviewed: 2026-07-28T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
