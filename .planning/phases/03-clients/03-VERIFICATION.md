---
phase: 03-clients
verified: 2026-07-28T09:07:01Z
status: human_needed
score: 3/3 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "CustomerCreateForm renders the unauthorized EmptyState (customers.create.notAuthorizedHeading/Body) when scope is null or hasOrgRole(scope, 'agent') is false"
    expected: "A user without at least 'agent' role in any agency (and not an org admin) sees the EmptyState denial screen instead of the form when navigating to /clients/nouveau"
    why_human: "The negative branch (src/features/customers/CustomerCreateForm.tsx:107-113) is implemented and type-checks, but no unit test in CustomerCreateForm.test.tsx mounts the component with an unauthorized/null scope — flagged as an open INFO finding (not part of the 8 fixed CR/WR items) in 03-03-SUMMARY.md coverage D9's rationale. Every existing test uses an authorized 'owner' scope, so only the positive path has automated coverage."
  - test: "End-to-end UAT: create an individual customer (identity doc + license), create a company customer (RC/NIF/NIS + drivers), then find and open an existing customer via search — through the running app, not fixtures"
    expected: "All three flows complete without error; the created/found records display correctly on the detail screen"
    why_human: "Flagged explicitly by the phase itself as coverage D9 in 03-04-SUMMARY.md (human_judgment: true, human_verify_mode=end-of-phase) — automated tests cover each screen's behavior against MSW fixtures in isolation, not a human's live judgment call on the full create→find→open round trip against a real or realistic environment."
---

# Phase 3: Clients Verification Report

**Phase Goal:** A user can create and find the customer records a rental contract needs, for both individuals and companies.
**Verified:** 2026-07-28T09:07:01Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can create an individual customer record through a form capturing identity document and driving license details | ✓ VERIFIED | `src/features/customers/CustomerCreateForm.tsx:250-320` renders `full_name`, `identity_doc_type` (cin/passport select), `identity_doc_number`, `license_number`, `license_issued_at`, `license_valid_until` for the individual branch. `src/features/customers/schemas.ts` encodes domain requiredness (`cinRequired` refine, `licenseDateOrder` refine). Route `/clients/nouveau` (`src/routes/_authenticated/clients/nouveau.tsx`) renders the form. Reachable via the CustomerList "New customer" CTA (CR-01 fix, confirmed in code, see below). Tests: `CustomerCreateForm.test.tsx` individual describe block (2 tests), `schemas.test.ts` (17 tests) — all pass. |
| 2 | User can create a company customer record (RC/NIF/NIS) with one or more designated drivers attached | ✓ VERIFIED | Company branch (`CustomerCreateForm.tsx:322-410`) renders `legal_name`, `rc`, `nif`, `nis`, and a `useFieldArray("drivers")` sub-form (add/remove rows). `mutations.ts`'s `useCreateCustomerMutation` performs create-then-attach (POST /customers, then sequential POST /customers/:id/drivers), with honest partial-failure handling and retry (CR-03, CR-04/WR-04 fixes verified in code). Tests: `CustomerCreateForm.test.tsx` company+drivers block (4 tests), `mutations.test.tsx` (8 tests) — all pass. |
| 3 | User can search for and locate an existing customer (individual or company) instead of re-creating a duplicate | ✓ VERIFIED | `CustomerList.tsx` implements server-side `?q=` search debounced (300ms) into `useCustomersQuery(q)`'s cache key; MSW handler (`src/test/mocks/handlers.ts:161-177`) filters fixtures over name/CIN/RC. Search controls stay mounted during in-flight requests (CR-02 fix: `placeholderData: keepPreviousData` in `queries.ts`, gate on `!query.isPending`, verified in code). Each row links to `/clients/$customerId`, resolved by the real `CustomerDetail.tsx` screen. Tests: `CustomerList.test.tsx` (12 tests incl. the CR-02 regression test), `src/app/router.test.tsx` (route integration) — all pass. |

**Score:** 3/3 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/customer.ts` | 1:1 DTO mirror of `customer_dto.go` | ✓ VERIFIED | Cross-checked line-by-line against `wheelio-api/internal/adapter/httpapi/customer_dto.go`. All `omitempty` fields optional, license dates `string \| null`, `archived_at` correctly excluded (not in response DTO). |
| `src/shared/auth/permissions.ts` | `hasOrgRole(scope, min)` org-wide gate | ✓ VERIFIED | Implements admin shortcut + `AtLeast(min)`-over-any-agency; distinct from per-agency `canOperate`/`canRead`/`canManage`. 6 dedicated unit tests in `permissions.test.ts` cover admin shortcut, single-agency membership at/below/above threshold, and empty-membership false case. |
| `src/features/customers/api.ts`, `queries.ts`, `mutations.ts` | Org-scoped data layer, no `currentAgencyId` in query keys | ✓ VERIFIED | `queries.ts` query keys `['customers','list',{q}]`, `['customers','detail',id]`, `['customers','detail',id,'drivers']` — no agency scoping, matches D-07/D-08 intent. Dedicated invariant test in `queries.test.tsx`. |
| `src/features/customers/CustomerList.tsx` | `/clients` list + search screen | ✓ VERIFIED | Renders responsive table/card, skeleton/error/empty/noResults quartet, discoverable "New customer" CTA gated by `hasOrgRole`. |
| `src/features/customers/CustomerCreateForm.tsx` | `/clients/nouveau` create screen | ✓ VERIFIED | Type-toggle radiogroup, per-type fields, drivers sub-form, partial-failure/retry UI, `hasOrgRole` gate. |
| `src/features/customers/CustomerDetail.tsx` | `/clients/$customerId` detail screen | ✓ VERIFIED | Individual identity+license card, company card+drivers list, presence-guarded optional fields, independent parallel-query failure handling, generic not-found state. |
| `src/routes/_authenticated/clients/{index,nouveau,$customerId}.tsx` | Real routes (no placeholder stubs remain) | ✓ VERIFIED | All three route files register the real components; Phase 1 flat `clients.tsx` placeholder deleted (03-02). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `CustomerList.tsx` header | `/clients/nouveau` | `<Link to="/clients/nouveau">{t("customers.create.cta")}</Link>` gated by `canCreate = hasOrgRole(scope,"agent")` | ✓ WIRED | Confirmed at `CustomerList.tsx:96-101`. This is the CR-01 fix — grep for `clients/nouveau` in `CustomerList.tsx` now returns a match (previously it did not, per the code review). Regression tests exist asserting CTA absence with no scope and presence with an authorized scope. |
| `CustomerCreateForm.tsx` submit | `POST /customers` then `POST /customers/:id/drivers` | `useCreateCustomerMutation` (create-then-attach, sequential) | ✓ WIRED | `mutations.ts:useCreateCustomerMutation` confirmed; navigates to `/clients/$customerId` on full success. |
| `CustomerList.tsx` row | `/clients/$customerId` | `Link` per row | ✓ WIRED | Confirmed row links resolve through the real generated route tree (`router.test.tsx` integration assertion). |
| `CustomerList.tsx` search input | `useCustomersQuery(q)` | debounced state → query key | ✓ WIRED | `showControls`/`showCount` gate on `!query.isPending`; `placeholderData: keepPreviousData` prevents control unmount during in-flight requests (CR-02 fix confirmed in `queries.ts` and `CustomerList.tsx`). |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|--------------|--------|----------|
| CUST-01 | 03-01, 03-03, 03-04 | Create individual customer (identity doc, license) | ✓ SATISFIED | Form fields + schema + create route confirmed in code; all tests pass. |
| CUST-02 | 03-01, 03-03, 03-04 | Create company customer (RC/NIF/NIS) with drivers | ✓ SATISFIED | Form fields + drivers sub-form + create-then-attach mutation confirmed; all tests pass. |
| CUST-03 | 03-01, 03-02, 03-04 | Search for and find an existing customer | ✓ SATISFIED | Server-side search + list + detail screens confirmed wired end-to-end. |

No orphaned requirements — REQUIREMENTS.md maps only CUST-01/02/03 to Phase 3, and all three are claimed and satisfied across the four plans.

### Code Review Findings — Fix Verification

The phase's 03-REVIEW.md found 9 issues (4 critical, 4 warning, 1 info). 03-REVIEW-FIX.md claims all 8 critical/warning findings were fixed (IN-01 explicitly out of scope). Each fix was independently verified in the current source (not merely from the fix report's narrative):

| Finding | Claimed Fix | Verified in Code |
|---------|-------------|-------------------|
| CR-01 — create screen unreachable | "New customer" CTA added to `CustomerList.tsx`, gated by `hasOrgRole` | ✓ Confirmed at `CustomerList.tsx:96-101`; commit `f89c225` present in `git log` |
| CR-02 — search flashes full skeleton | `placeholderData: keepPreviousData` + gate on `isPending` | ✓ Confirmed in `queries.ts:32` and `CustomerList.tsx:88`; commit `34d5696` present |
| CR-03 — stale drivers rows on type toggle | `useEffect` calling `replace([])` on `type === "individual"` | ✓ Confirmed at `CustomerCreateForm.tsx:154-155`; commit `ff7024a` present |
| CR-04 — retry resubmits stale payload | `retryFailed` reads `getValues("drivers")` at retry time | ✓ Confirmed at `CustomerCreateForm.tsx:182-193`; commit `4f129ab` present |
| WR-01 — untranslated Zod messages | i18n message keys added to `.min(1)` constraints | ✓ Confirmed at `schemas.ts:34,37,59,71,73` (`fullNameRequired`, `legalNameRequired`, `rcRequired`, `driverFullNameRequired`, `driverLicenseNumberRequired`); commit `29885ce` present |
| WR-02 — missing FieldError on phone/address/license_number | `<FieldError>` + `aria-invalid` wired | ✓ Confirmed at `CustomerCreateForm.tsx:302-311,419-427`; commit `e3bbc1a` present |
| WR-03 — unvalidated id interpolation | `encodeIdSegment` (encodeURIComponent) helper | ✓ Confirmed at `api.ts:29-30,40,45,60`; commit `9885dd1` present |
| WR-04 — dead diagnostic error data | `driverFailureMessage` surfaces captured error | ✓ Confirmed at `CustomerCreateForm.tsx:97-101`; fixed together with CR-04 in commit `4f129ab` |

All 8 commit hashes cited in 03-REVIEW-FIX.md are present in `git log --oneline --all`. Full test suite (193/193 across 24 files) and `tsc --noEmit` pass on current HEAD, independently re-run during this verification (not taken from SUMMARY claims).

**IN-01 (open, non-blocking):** `company` schema branch declares license fields (`license_number`/`license_issued_at`/`license_valid_until`) with no corresponding form UI in the company branch — dead schema surface, explicitly out of scope for the fix pass. Does not block CUST-01/02/03 since companies don't need a personal license (only their drivers do, which have their own license fields). Noted, not a gap.

### Anti-Patterns Found

No blocker-level anti-patterns (TBD/FIXME/XXX markers) found in the phase's modified files. No stub returns (`return null`, empty handlers) in the create/list/detail screens — all handlers wire to real mutations/queries. `console.log`-only implementations: none found.

### Human Verification Required

1. **hasOrgRole unauthorized branch of CustomerCreateForm** — no dedicated unit test asserts the EmptyState renders when `hasOrgRole(scope, "agent")` is false or `scope` is null. Code is present and type-checks (`CustomerCreateForm.tsx:107-113`); this is the INFO-level finding the task called out as remaining open and non-blocking. Recommend a human/manual check (or a quick follow-up unit test) before treating CUST-01's authorization boundary as fully proven, though this does not block phase completion.
2. **End-to-end create→find→open UAT** — the phase's own 03-04-SUMMARY.md flags this as `human_judgment: true` (coverage D9), pending a run of `/gsd-verify-work`. Automated tests cover each screen's behavior against MSW fixtures in isolation but not a live human round-trip.

### Gaps Summary

No blocking gaps found. All three roadmap success criteria are backed by real, wired, tested code — not stubs. The 8 code-review findings (4 critical, 4 warning) were independently confirmed fixed in the current source, with their commits present in git history and the full test suite green. Two items are routed to human verification: the untested `hasOrgRole` negative branch (non-blocking, matches the task's flagged INFO item) and the phase's own explicitly-planned end-of-phase UAT.

---

_Verified: 2026-07-28T09:07:01Z_
_Verifier: Claude (gsd-verifier)_
