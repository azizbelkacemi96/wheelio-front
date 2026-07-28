# Roadmap: Wheelio Front

## Overview

Wheelio Front is a greenfield SPA that exposes `wheelio-api`'s golden path — vehicle → customer → contract → état des lieux → invoice — to three role-based users (agent, manager, owner) through one responsive, bilingual dashboard. The roadmap builds outward-in: foundations that are expensive to retrofit (auth with transparent refresh, role-aware shell, i18n, design system) ship first, then each remaining phase completes one full requirement category in dependency order — fleet and customers (independent CRUD, no cross-dependency), then the contract lifecycle that needs both, then the higher-risk on-site inspection/photo-capture flow that needs an active contract, then fiscal-identity-gated billing that needs contract closure. Every phase ships a complete, user-verifiable capability rather than a technical layer shared across features.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundations — Auth, Shell, i18n, Design System** - Login with transparent session refresh, role-aware navigation, agency switching, FR/EN i18n, and a consistent design-token/component library
- [x] **Phase 2: Fleet** - Vehicle list with live status and vehicle detail view
- [ ] **Phase 3: Clients** - Individual/company customer creation, designated drivers, and search
- [ ] **Phase 4: Contrats de location** - Full reservation → activation → closure → cancellation lifecycle as a guided wizard, plus a "today" overview
- [ ] **Phase 5: État des lieux** - Departure/return inspections with zone-based damage entry and resilient on-site photo capture
- [ ] **Phase 6: Identité fiscale & Facturation** - Fiscal-identity gate, invoice view, payments, credit notes, and authenticated PDF downloads

## Phase Details

### Phase 1: Foundations — Auth, Shell, i18n, Design System

**Goal**: A user can log in, see navigation and actions that match their role, work across agencies and sessions without interruption, and experience one consistently designed, bilingual interface from the very first screen.
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06
**Success Criteria** (what must be TRUE):

  1. User can log in with email/password and remains logged in across browser sessions, with token refresh happening invisibly (no forced re-login during normal use).
  2. An expiring session never hard-redirects a user out of in-progress work — refresh completes silently before any redirect to login could occur.
  3. User's navigation menu and available actions match their role (agent/manager/owner) exactly as returned by the backend's `/me` scope — no independently re-derived role logic.
  4. Owner user can switch between agencies within their organization, and the shell reflects the newly selected agency context everywhere.
  5. User can switch the interface language between French (default) and English at any time, and every screen — including the shared component library and design-token-driven layout, header, and navigation — reflects the choice immediately.

**Plans**: 7/7 plans executed
**Wave 1**

- [x] 01-01-PLAN.md — Scaffold Vite+React19+TS app, build/test tooling, DTO types + MSW mocks (Wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Design-token system (light+dark), ThemeProvider, base component library (Wave 2)
- [x] 01-03-PLAN.md — Auth core: permissions port, Zustand store, single-flight refresh client (Wave 2)
- [x] 01-04-PLAN.md — i18n runtime: FR-default/EN, CLDR plurals, copy inventory (Wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-05-PLAN.md — Login + signup screens (Wave 3)
- [x] 01-06-PLAN.md — Role-aware shell: route guard, nav, agency switcher, top bar (Wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-07-PLAN.md — Placeholder pages + E2E happy path (Wave 4)

**UI hint**: yes

### Phase 2: Fleet

**Goal**: A user can see the real-time state of the vehicle fleet and drill into any vehicle's details.
**Depends on**: Phase 1
**Requirements**: FLEET-01, FLEET-02
**Success Criteria** (what must be TRUE):

  1. User can view a list of all vehicles showing live status (available, rented, in maintenance, etc.).
  2. User can open a vehicle's detail page and see its plate, brand/model, mileage, fuel level, and current contract if one exists.

**Plans**: 3/3 plans executed

Plans:

- [x] 02-01-PLAN.md — /v1 base-URL fix, fleet/rental DTO mirrors, MSW fleet handlers + fixtures, query hooks + StatusBadge + i18n (Wave 1)
- [x] 02-02-PLAN.md — Vehicle list screen: dense table/cards, status filter + search, UI states, placeholder route replacement (Wave 2)
- [x] 02-03-PLAN.md — Vehicle detail screen: vehicle card + current-contract summary, $vehicleId route, phase gate (Wave 3)

**UI hint**: yes

### Phase 3: Clients

**Goal**: A user can create and find the customer records a rental contract needs, for both individuals and companies.
**Depends on**: Phase 1
**Requirements**: CUST-01, CUST-02, CUST-03
**Success Criteria** (what must be TRUE):

  1. User can create an individual customer record through a form capturing identity document and driving license details.
  2. User can create a company customer record (RC/NIF/NIS) with one or more designated drivers attached.
  3. User can search for and locate an existing customer (individual or company) instead of re-creating a duplicate.

**Plans**: 2/4 plans executed

Plans:

- [x] 03-01-PLAN.md — Customer contract foundation: DTO mirror, hasOrgRole org-scope gate, MSW handlers + fixtures, api/queries, customers.* i18n (Wave 1)
- [x] 03-02-PLAN.md — Customer list + server-side ?q= search at /clients, placeholder replacement + E2E/placeholder-test migration (Wave 2)
- [ ] 03-03-PLAN.md — Create form: individual/company type toggle, discriminated-union validation, drivers field array, create-then-attach mutation (Wave 3)
- [ ] 03-04-PLAN.md — Customer detail at /clients/$customerId + company drivers, phase gate (unit + tsc + build + playwright) (Wave 4)

**UI hint**: yes

### Phase 4: Contrats de location

**Goal**: A user can run one full rental transaction — reserve, activate, close, or cancel — as a single guided flow, and immediately see what's due today.
**Depends on**: Phase 2, Phase 3
**Requirements**: RENT-01, RENT-02, RENT-03, RENT-04, RENT-05, OPS-01
**Success Criteria** (what must be TRUE):

  1. User can create a rental reservation for an available vehicle and a customer, with any overlapping-booking attempt rejected with a clear, friendly error rather than a silent double-booking.
  2. User can activate a reservation (recording departure mileage and fuel level) and later close it (recording return mileage, fuel level, and invoice lines), with the contract visibly moving through reservation → active → closed states.
  3. User can cancel a reservation or an active contract, and the reason given is recorded against it.
  4. User is guided through vehicle → customer → contract → departure inspection as one continuous wizard screen flow, not four disconnected screens.
  5. User sees a "today" overview on landing showing which vehicles are due for pickup or return today.

**Plans**: TBD
**UI hint**: yes

### Phase 5: État des lieux

**Goal**: A user can produce a photo-documented, trustworthy condition record at both departure and return that survives flaky field connectivity.
**Depends on**: Phase 4
**Requirements**: INSP-01, INSP-02, INSP-03
**Success Criteria** (what must be TRUE):

  1. User can perform a departure (sortie) inspection recording mileage, fuel level, and damage entered per canonical vehicle zone.
  2. User can capture a photo on-site through a responsive mobile/tablet interface and attach it to a specific recorded damage, with in-progress capture surviving a dropped connection (incremental upload, automatic retry, no silent loss).
  3. User can perform a return (retour) inspection using the same zone-based damage entry.

**Plans**: TBD
**UI hint**: yes

### Phase 6: Identité fiscale & Facturation

**Goal**: A user can only issue compliant invoices once the organization's fiscal identity is complete, and can manage the full payment/credit lifecycle plus document downloads from there.
**Depends on**: Phase 4, Phase 5
**Requirements**: BILL-01, BILL-02, BILL-03, BILL-04, BILL-05
**Success Criteria** (what must be TRUE):

  1. User is actively blocked from issuing any invoice until the organization's fiscal identity (NIF/NIS/RC/legal form/address) is complete — the gate stops the action, it does not just warn.
  2. User can view an invoice showing all décret 05-468 mandatory mentions (TVA 19%/9%, timbre fiscal, DZD, sequential numbering).
  3. User can record a payment against an invoice (cash/card/transfer) and see the invoice balance reflect it.
  4. User can issue a credit note (avoir) against an invoice.
  5. User can download the invoice, the rental contract, and the inspection report as PDF through an authenticated download flow — never a bare unauthenticated link.

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundations — Auth, Shell, i18n, Design System | 7/7 | Complete (2 visual backstop checks deferred to user's final review, see 01-VERIFICATION.md) | 2026-07-23 |
| 2. Fleet | 3/3 | Complete | 2026-07-27 |
| 3. Clients | 2/4 | In Progress|  |
| 4. Contrats de location | 0/TBD | Not started | - |
| 5. État des lieux | 0/TBD | Not started | - |
| 6. Identité fiscale & Facturation | 0/TBD | Not started | - |
