---
status: testing
phase: 03-clients
source: [03-VERIFICATION.md]
started: 2026-07-28T09:10:00Z
updated: 2026-07-28T09:10:00Z
---

## Current Test

number: 1
name: End-to-end create → find → open round trip
expected: |
  Through the running app (not MSW fixtures): create an individual customer
  (identity document + driving license), create a company customer
  (RC/NIF/NIS + one or more designated drivers), then search for and open an
  existing customer via the /clients search box. All three flows complete
  without error and the created/found records display correctly on the
  /clients/$customerId detail screen.
awaiting: user response

## Tests

### 1. End-to-end create → find → open round trip
expected: |
  Create an individual customer (identity doc + license) via the "New customer"
  CTA on /clients → /clients/nouveau; create a company customer (RC/NIF/NIS +
  drivers); then find an existing customer through the search box and open its
  detail screen. All three complete without error; records render correctly on
  the detail screen.
why_human: |
  Phase's own 03-04-SUMMARY.md flags this as human_judgment: true (coverage D9,
  human_verify_mode=end-of-phase). Automated tests cover each screen against MSW
  fixtures in isolation, not a live human round trip.
result: [pending]

### 2. hasOrgRole unauthorized branch renders the denial EmptyState
expected: |
  A user without at least 'agent' role in any agency (and not an org admin),
  navigating to /clients/nouveau, sees the EmptyState denial screen
  (customers.create.notAuthorizedHeading / notAuthorizedBody) instead of the
  create form.
why_human: |
  Negative branch (CustomerCreateForm.tsx:107-113) is implemented and
  type-checks but has no dedicated unit test — every existing test mounts an
  authorized 'owner' scope. Open INFO finding, non-blocking. A quick follow-up
  unit test would also satisfy this.
result: [pending]
