# Feature Research

**Domain:** Car rental / fleet-management SaaS dashboard (B2B ops tool for rental agency staff, not a corporate fleet-of-employees tool, not a consumer booking site)
**Researched:** 2026-07-22
**Confidence:** MEDIUM

Confidence note: findings are triangulated across multiple rent-a-car SaaS vendor sites (Booqable, RentSyst, HQ Rental Software, Rently Soft, AiRentoSoft, Rentgine, MCS Rental Software, VEVS), inspection-app vendors (Driveroo, GoCanvas, Sintel, Damage iD), and general multi-tenant SaaS UX write-ups. These are industry-consensus/marketing sources, not primary documentation — treat as MEDIUM confidence directional guidance, not gospel. Cross-checked against `.planning/PROJECT.md`'s already-decided scope (Active/Out of Scope) which is the authoritative source for this project and overrides generic industry patterns wherever they conflict.

## Feature Landscape

### Table Stakes (Users Expect These)

Scoped to what's needed to make the **v1 golden path already decided in PROJECT.md** (vehicle → customer → contract → inspection → close → invoice) feel complete, not the full universe of rent-a-car features.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Vehicle list with live status (available / reserved / rented / maintenance / out-of-service) | Every rent-a-car tool leads with "what can I rent right now" — agents check this dozens of times/day | LOW | Backend already exposes vehicle status; front just needs clear visual state (badge/color), not a new concept |
| Vehicle detail view (plate, model, year, mileage, fuel type, current contract if any) | Agent needs to confirm the exact car before committing a customer to it | LOW | Straight CRUD read view over existing fleet API |
| Overlap-proof booking UX (attempt to double-book a vehicle is rejected with a clear reason) | Backend guarantees no overlap at the DB level (EXCLUDE constraint) — front must surface this as a friendly error, not a raw 409 | LOW–MEDIUM | Pure UX layer over an API contract that already exists; the hard problem (data integrity) is solved server-side |
| Customer record creation/search (individual vs. business, duplicate-aware search by phone/ID) | Nearly universal in rent-a-car software; agents re-rent to repeat customers constantly and need fast lookup, not re-typing | LOW–MEDIUM | v1 scope already includes "création/fiche client + conducteurs désignés" — dedup-by-search is the missing UX nuance research adds |
| Designated additional driver(s) on a contract | Standard line item on every car rental agreement (insurance/liability); already in PROJECT.md Active scope | LOW | Data already modeled per PROJECT.md; front needs a simple add/remove driver UI on the contract form |
| Contract lifecycle stepper: reservation → activation (departure) → closure (return) → (cancellation) | This is literally the backend's contract state machine — matches PROJECT.md Active scope exactly | MEDIUM | The UI value-add is making the *state machine visible* (what actions are valid now) rather than a flat CRUD form |
| Mileage + fuel level capture at departure and return | Universal in every rental agreement template reviewed — mileage cap/overage and fuel policy (full-to-full) are near-universal contract terms | LOW–MEDIUM | Must confirm these fields exist in the rental/inspection API payload; if not yet modeled, flag as a gap for requirements, since every competitor treats this as non-negotiable |
| Damage inspection with per-zone marking + photo capture, done twice (departure/return) | Core differentiator-turned-table-stakes across the whole inspection-app category (GoCanvas, Driveroo, Sintel, Damage iD) — dispute prevention is the #1 reason this software category exists at all | MEDIUM–HIGH | Already in PROJECT.md Active scope; the field-conditions constraint (mobile/tablet, outdoors, gloves, glare) is the real complexity driver, not the CRUD |
| Departure vs. return damage comparison (surfacing *new* damage since checkout) | This is the entire value proposition of the inspection module — without it, two separate photo sets are just data, not information | MEDIUM | Not explicitly called out in PROJECT.md Active bullets as a distinct feature — worth confirming in requirements; likely expected by any agency owner who has used a competitor |
| Invoice view + PDF download (contract, inspection report, invoice) | Already in PROJECT.md Active scope; billing/invoicing and reporting is universal table stakes across every rent-a-car vendor surveyed | LOW–MEDIUM | Backend PDF streaming endpoints already exist; front is a viewer/download trigger, not a generator |
| Payment recording (manual, per Algeria norms — cash/card/cheque) + credit note issuance | Already in PROJECT.md Active scope | LOW–MEDIUM | No online payment (explicitly out of scope) — this is agency-entered, not customer-facing |
| Fiscal identity setup (NIF/NIS/RC/legal form/address) as a blocking gate before first invoice | Called out explicitly in PROJECT.md as "bloquant pour l'émission de facture conforme" | LOW | This is a compliance table stake specific to Algeria, not generic SaaS — must be enforced in UI (disable/redirect to setup) before any invoice action |
| Role-aware navigation (agent / manager / owner see different menus and actions) | Universal expectation in any multi-role B2B dashboard — users are confused/frustrated by seeing actions they can't perform | MEDIUM | Backend already returns Scope (CanRead/CanOperate/CanManage, IsOrgAdmin) via `/me` + JWT — front must *drive from this*, never invent its own role logic (already a Key Decision/constraint in PROJECT.md) |
| Agency switcher for multi-agency owners | Multi-tenant SaaS UX consensus: an always-visible org/tenant switcher (header or sidebar) is the standard pattern (Slack-style) when a user can belong to >1 scope | LOW–MEDIUM | Only relevant for the owner role per PROJECT.md's 3 profiles; agent/manager are agency-scoped and don't need it |
| Ops "today" overview (pickups due, returns due, overdue returns) | Near-universal dashboard-home pattern across rent-a-car vendors (RentSyst, MCS, Rentgine "Smart Alerts") — this is what an agent/manager opens the app to see first each day | MEDIUM | Not explicitly in PROJECT.md Active scope as a named feature — worth flagging in requirements as likely-expected even for a "golden path only" v1, since it's cheap (read-only aggregation over existing contract data) and high perceived value |
| Bilingual FR/EN UI | Already decided and in PROJECT.md Active scope | MEDIUM | Architecture-level decision already made; not a "feature" debate, just needs consistent execution across every screen |

### Differentiators (Competitive Advantage)

Genuinely valuable, but should be flagged for v1.1+ rather than blocking the golden-path demo. Align with the Core Value: a single, professional, terrain-usable interface that closes the vehicle→invoice loop.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Guided step-by-step "new rental" wizard (vehicle → customer → contract → départ EDL, one flow) | Reduces agent error and training time versus 4 separate CRUD screens; turns the golden path into the literal product UX, which doubles as the sales demo | MEDIUM | This is the single highest-leverage differentiator given the stated "démontrable de bout en bout" success metric — worth prioritizing over other differentiators even in v1 if time allows |
| Side-by-side departure/return damage comparison view (photo-to-photo, zone highlighted) | Goes beyond "table stakes: has two photo sets" to actually doing the dispute-prevention job well — this is where inspection-app vendors (Driveroo, Damage iD) differentiate from each other | MEDIUM–HIGH | Natural v1.1 add once basic departure/return capture works; don't gate the golden-path demo on this |
| Fleet availability calendar (Gantt/timeline view across vehicles and dates) | Lets a manager see the whole fleet's booking horizon at a glance instead of checking vehicles one by one — common in HQ Rental Software, RentSyst | MEDIUM–HIGH | High value for agency managers, but not required to prove the golden path with one vehicle/one customer in a demo |
| Contextual quick actions ("Create contract for this vehicle" from the vehicle card/list) | Removes navigation friction in the exact golden-path flow; small effort, meaningful UX polish | LOW | Cheap enhancement once core screens exist; good v1 stretch goal, not a blocker |
| Contract/invoice PDF branded with agency identity (logo, colors) | Professional look reinforces the "sales argument" success metric explicitly named in PROJECT.md | LOW–MEDIUM | Depends on whether backend PDF templates support per-org branding today — needs a backend capability check before promising it |
| Basic utilization/revenue analytics (per-vehicle revenue, fleet utilization %) | Common further-down-the-line feature across every vendor surveyed (RentSyst "business intelligence tools", HQ Rental "revenue insights") | MEDIUM–HIGH | Clearly v1.1+; requires aggregation queries the backend doesn't obviously expose yet |
| Digital contract e-signature (in-app, tablet) | RentSyst and similar vendors treat this as a differentiator ("digital agreements with e-signatures") | HIGH | Backend has no e-signature capability today (only PDF generation) — this is a v2+ candidate requiring new backend work, not just front-end |

### Anti-Features (Commonly Requested, Often Problematic)

Includes both features already excluded in PROJECT.md's "Out of Scope" (restated here with the competitive-research rationale, since downstream requirements-writing benefits from the "why") and additional anti-features surfaced by this research.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Customer-facing online booking widget / self-service portal | Nearly every competitor (Booqable, RentSyst, AiRentoSoft) leads marketing with this; feels like "everyone has it" | Explicitly out of scope per PROJECT.md — no marketing site, no self-signup, backend has no public booking surface, and it targets a completely different persona (end renter) than this milestone (agency staff) | Keep the dashboard 100% internal-facing; if online booking is ever wanted, it's a separate product surface built on the same API, not a dashboard feature |
| Native mobile app (iOS/Android) | Field work (inspections) "feels like" it needs a native app for camera/offline access | Already decided against in PROJECT.md — doubles maintenance for a benefit a responsive web app can deliver (camera access works fine via browser `<input capture>`/File API on modern mobile browsers) | One responsive web app; test camera capture and touch-target sizing carefully on real devices during the inspection phase |
| Online payment gateway integration | Common competitor feature (RentSyst integrates Stripe/PayPal) | Already out of scope — Algeria SaaS B2B context, agency staff record payments manually (cash/card/cheque in person); adding a payment gateway means PCI-adjacent scope, disputes, and refund flows nobody asked for | Manual payment recording UI only, exactly as already scoped |
| End-customer portal (renter-facing account/history) | Feels "complete" compared to consumer rental brands | Already out of scope — API and front stay internal-agency-only; a renter portal is a different product with different auth, different data exposure risk | None needed for v1; if ever requested, treat as a distinct product initiative |
| AI-powered automated damage detection (photo → auto-flag damage) | Marketed heavily by AiRentoSoft and similar vendors as a cutting-edge differentiator | Immature/expensive for a v1 whose core success metric is "demonstrable end-to-end golden path," not AI sophistication; false positives/negatives on damage detection create trust problems worse than manual zone-tagging | Manual zone-based damage tagging + photos (already the scoped approach) — revisit AI assist only after the manual flow is proven and if agencies request it |
| GPS/telematics live vehicle tracking | Common in "fleet management" software aimed at corporate fleets, and shows up in some rent-a-car suites (RentSyst's OBD-II integration) | Requires hardware (OBD-II/GPS units) per vehicle, a live data pipeline, and map UI — an entirely different engineering investment with no connection to the stated golden path or current backend capability | Manual odometer/mileage entry at departure and return, as already scoped |
| Dynamic/yield pricing engine | Big rental chains (and some SaaS vendors) offer demand-based pricing | Wildly over-engineered for small-to-mid Algerian agencies in a v1 golden-path milestone; adds a pricing-strategy UI nobody in the target user base (3 roles, single/few agencies) has asked for | Simple daily/period rate entry on the contract, as already implied by PROJECT.md's billing scope |
| Marketing/CRM features (email campaigns, SMS marketing, loyalty programs) | Some vendors bundle these (EZ Texting rental SMS marketing, loyalty club alerts) | Out of scope for an internal ops tool serving 3 staff roles; this is marketing-surface territory, not fleet-ops territory, and there's no marketing site to begin with per PROJECT.md | None needed; if customer communication is wanted later, scope it as a distinct feature request tied to a real need (e.g., return reminders — see differentiators/future) |
| Channel manager / OTA integrations (Booking.com-style distribution) | Common in car-rental SaaS aimed at growth-stage agencies wanting more bookings | No online storefront exists or is planned; integrating distribution channels without a booking front end is meaningless | Not applicable until/unless a self-serve booking product is ever built (currently explicitly not planned) |
| Vehicle documents / maintenance modules surfaced in v1 nav | These exist in the API already (maintenance plans, document uploads/expiry) and it's tempting to "just expose what's there" | Already explicitly deferred in PROJECT.md ("hors du parcours cœur v1 ; viendront en phase(s) suivante(s)") — building UI for them now dilutes focus on proving the golden path fast | Leave these API modules unexposed in v1 nav; revisit as a dedicated phase after the golden path ships |

## Feature Dependencies

```
Auth + Role-aware navigation (RBAC from /me + JWT)
    └──requires──> nothing (foundational — must land first)

Agency switcher (multi-agency owner)
    └──enhances──> Role-aware navigation
                       └──requires──> Auth (JWT/Scope already resolves agencies)

Fiscal identity setup (NIF/NIS/RC/adresse)
    └──blocks──> Invoice PDF generation / emission
                     (already stated as blocking in PROJECT.md)

Vehicle list + status
    └──requires──> Fleet API (existing, read-only for v1)

Customer record (individual/business + designated drivers)
    └──requires──> nothing beyond Auth
    └──feeds──> Contract creation (reservation)

Contract creation (reservation)
    └──requires──> Vehicle (available) + Customer (exists)
    └──requires──> Overlap-proof booking check (server-enforced, front surfaces result)

Contract activation (departure)
    └──requires──> Contract in "reservation" state
    └──triggers──> Inspection — departure (mileage, fuel, damage zones/photos)

Inspection — departure
    └──requires──> Contract activation
    └──feeds──> Inspection — return (comparison baseline)

Contract closure (return)
    └──requires──> Inspection — return (mileage, fuel, damage zones/photos)
    └──feeds──> Billing lines (mileage overage, fuel, damage charges, extras)

Billing / Invoice
    └──requires──> Contract closure (return) + Fiscal identity setup
    └──feeds──> Payment recording, Credit note issuance, PDF download

Damage comparison view (differentiator)
    └──requires──> Inspection — departure AND Inspection — return
                       (cannot exist until both capture points are built)

Fleet availability calendar (differentiator)
    └──enhances──> Vehicle list + Contract creation
    └──requires──> Contract data across date ranges (aggregation, not new domain data)

Guided "new rental" wizard (differentiator)
    └──requires──> Vehicle list, Customer record, Contract creation, Inspection — departure
                       (it's a UX wrapper around already-built table-stakes screens, not new data)

Ops "today" overview (table stakes, borderline v1/v1.1)
    └──requires──> Contract lifecycle data (reservation/activation/closure) existing and queryable
```

### Dependency Notes

- **Fiscal identity setup blocks Invoice PDF generation:** this is not a suggestion — PROJECT.md states it explicitly ("bloquant pour l'émission de facture conforme"). The roadmap must place fiscal identity setup in the same phase as, or before, billing/invoicing, and the UI must hard-gate invoice actions until the org's fiscal identity is complete.
- **Damage comparison requires both departure and return inspection to exist first:** don't attempt to build the comparison view in the same phase as the first (departure) inspection capture — there's nothing to compare against yet. Sequence: departure inspection → return inspection → comparison view (if pursued at all in v1.x).
- **Role-aware navigation requires Auth/Scope resolution to exist first:** every other screen's visible actions depend on Scope.CanRead/CanOperate/CanManage and IsOrgAdmin being resolved and available in front-end state. This is correctly the earliest phase.
- **Agency switcher only matters after multi-agency data exists in the resolved scope:** it enhances but doesn't block the golden path for a single-agency agent/manager — only the owner role needs it, so it can land slightly later without blocking a single-agency demo.
- **Guided wizard is a UX layer over already-existing screens, not a dependency-adding feature:** it can be deferred to v1.1 without blocking anything, but if the "démontrable de bout en bout" sales-demo argument is taken seriously, it's worth pulling into v1 as the primary flow rather than 4 disconnected CRUD screens, since it directly serves the stated success metric.
- **Billing feeds from contract closure line items (mileage overage, fuel, damage, extras):** confirm during requirements whether these charge types are already computed server-side or need front-end computation/display — this affects whether "closure" and "billing" can be separate phases or must be combined.

## MVP Definition

### Launch With (v1)

Minimum viable product — matches PROJECT.md's Active requirements almost exactly; anything beyond this list should require justification against the stated success metric.

- [ ] Auth (login, session, JWT refresh) — nothing else works without it
- [ ] Role-aware navigation driven by backend Scope/JWT (3 profiles) — required so each of the 3 target user types sees a coherent, trustworthy tool from day one
- [ ] Fleet: vehicle list + detail (status, mileage) — first step of the golden path
- [ ] Customers: create/search individual & business, designated drivers — second step of the golden path
- [ ] Contracts: reservation → activation → closure → cancellation — the spine of the golden path
- [ ] Inspection: departure and return, zone-based damage entry, photo capture (mobile-capable) — the trust-building step that differentiates this category of software from generic booking tools
- [ ] Fiscal identity setup (blocking gate) — required before any invoice can be legally emitted
- [ ] Billing: invoice view, payment recording, credit note issuance, PDF download (invoice/contract/inspection) — closes the loop, is the literal "proof of value" deliverable
- [ ] Bilingual FR/EN — architectural decision already locked in, must be present from the first screen
- [ ] Agency switcher (owner role only) — needed the moment more than one agency exists in a demo account

### Add After Validation (v1.x)

Trigger: golden path ships and is demoed successfully at least once; these add polish/depth without changing the core loop.

- [ ] Guided "new rental" wizard tying the 4 golden-path screens into one flow — add once individual screens are proven, to reduce agent friction and sharpen the sales demo further
- [ ] Departure/return damage comparison view — add once both inspection capture points exist and there's real photo data to compare
- [ ] Ops "today" overview (pickups/returns due) — add once enough contracts exist in real usage to make the aggregation meaningful; cheap to build, high perceived value
- [ ] Contextual quick actions (create-contract-from-vehicle-card) — small UX polish once navigation patterns are settled
- [ ] Branded PDF templates (agency logo/colors) if backend supports per-org templating — trigger: a demo/sales conversation where a prospect asks for their branding on documents

### Future Consideration (v2+)

Defer until the golden path has real usage and product-market signal, or until backend capability exists.

- [ ] Fleet availability calendar (Gantt/timeline view) — defer until multi-vehicle, multi-week usage patterns emerge that make a single-vehicle-at-a-time view feel limiting
- [ ] Basic utilization/revenue analytics dashboard — defer until backend exposes aggregation queries and there's a clear owner-role user asking for it
- [ ] Digital contract e-signature — defer indefinitely until backend adds signature capability; not a front-end-only feature
- [ ] Return-reminder notifications (email/SMS/in-app) — defer until the ops overview proves valuable and a delivery channel (email/SMS provider) is chosen deliberately, not bundled in reactively
- [ ] Maintenance module UI, vehicle document upload/expiry UI — explicitly deferred per PROJECT.md; revisit as a dedicated milestone once the golden path is stable

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Auth + role-aware nav | HIGH | MEDIUM | P1 |
| Vehicle list/detail + status | HIGH | LOW | P1 |
| Customer create/search + drivers | HIGH | LOW-MEDIUM | P1 |
| Contract lifecycle (reserve/activate/close/cancel) | HIGH | MEDIUM | P1 |
| Inspection departure/return (zones + photos) | HIGH | MEDIUM-HIGH | P1 |
| Fiscal identity setup gate | HIGH | LOW | P1 |
| Billing (invoice/payment/credit note/PDF) | HIGH | MEDIUM | P1 |
| Bilingual FR/EN | HIGH | MEDIUM | P1 |
| Agency switcher (owner) | MEDIUM | LOW-MEDIUM | P1 |
| Guided golden-path wizard | HIGH | MEDIUM | P2 |
| Damage comparison view | MEDIUM-HIGH | MEDIUM | P2 |
| Ops "today" overview | MEDIUM | LOW-MEDIUM | P2 |
| Contextual quick actions | LOW-MEDIUM | LOW | P2 |
| Branded PDF templates | LOW-MEDIUM | LOW-MEDIUM | P2/P3 |
| Fleet availability calendar | MEDIUM | MEDIUM-HIGH | P3 |
| Utilization/revenue analytics | MEDIUM | MEDIUM-HIGH | P3 |
| E-signature | LOW (for now) | HIGH | P3 |
| Return-reminder notifications | MEDIUM | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch (matches PROJECT.md Active scope)
- P2: Should have, add when possible (v1.x)
- P3: Nice to have, future consideration (v2+)

## Competitor Feature Analysis

| Feature | RentSyst | HQ Rental Software / AiRentoSoft-class vendors | Our Approach |
|---------|----------|------------------------------------------------|--------------|
| Fleet/availability tracking | Real-time dashboard, VOS (OBD-II ingestion) automating mileage/fuel | Automated vehicle availability by model/date range, rate tables | Status-driven vehicle list, server-enforced overlap prevention (no telematics hardware in v1) |
| Inspection/damage documentation | Not a headline feature in the sources reviewed | AI-powered damage detection (AiRentoSoft) | Manual zone-based tagging + photos at departure/return (proven, dispute-preventing pattern from Driveroo/Damage iD/Sintel-class tools), no AI detection in v1 |
| Billing/invoicing | Automated mileage/fuel-difference billing, Stripe/PayPal/QuickBooks integration | Rate tables + automated invoicing | Algeria-compliant invoice (NIF/NIS/RC, TVA 19%/9%, timbre, DZD), manual payment recording, no payment gateway |
| Contracts | Digital agreements with e-signature | Standard contract automation | PDF contract generation (existing backend capability), no e-signature in v1 |
| Multi-tenant/branch | Full fleet and order control across scale | Multi-branch management | Multi-agency owner scope with agency switcher, RBAC-driven nav (3 roles) |
| Customer-facing booking | Web-App booking (iOS/Android + web) | Web-based reservation | None — internal-only dashboard, no customer-facing surface (deliberate anti-feature per PROJECT.md) |

## Sources

- [Cordis USA — Car Rental Management Software](https://www.cordis.us/car-rental-management-software/)
- [Booqable — Car Rental Software](https://booqable.com/industries/car-rental-software/)
- [Rently Soft — Car Rental Management Software](https://rentlysoft.com/)
- [RentAAA — Fleet Management Software](https://rentaaa.com/fleet-management/)
- [RentHub Software — Vehicle Fleet Management for Car Rental](https://www.renthubsoftware.com/en/car-rental-software-and-cloud-management/vehicle-fleet-management-car-rental-software-features/)
- [TopRentApp — Car Rental Software](https://toprentapp.com/)
- [AiRentoSoft — Car Rental Software with AI Booking & Fleet Management](https://airentosoft.com/car-rental-software)
- [AiRentoSoft — AI-powered damage detection](https://airentosoft.com/AI-powered-damage-detection)
- [GoCanvas — Damage Control Vehicle Inspection Form](https://www.gocanvas.com/mobile-forms-apps/18007-Damage-Control-Vehicle-Inspection)
- [Driveroo Inspector — Rental Car Inspection Checklist](https://www.driveroo.com/inspector-app/rental-car-inspection-checklist-form/)
- [Auto Rental News — How One Rental Company Uses a Digital Tool to Detect Vehicle Damage](https://www.autorentalnews.com/10202946/how-one-rental-service-uses-a-new-digital-tool-to-detect-vehicle-damage)
- [Sintel Apps — Vehicle Inspection App](https://sintelapps.com/vehicle-inspection-app/)
- [Speed Auto Systems — Vehicle Mobile Inspection (VMI) for Car Rentals](https://speedautosystems.com/vehicle-mobile-inspection/for-car-rentals/)
- [MapTrack — Free Rental Vehicle Inspection Checklist](https://www.maptrack.com/templates/rental-vehicle-inspection-checklist)
- [WorkOS — The developer's guide to SaaS multi-tenant architecture](https://workos.com/blog/developers-guide-saas-multi-tenant-architecture)
- [Covio — Improving UX for Multi-Tenant SaaS Platforms](https://covio.agency/improving-ux-for-multi-tenant-saas-platforms/)
- [Logto — Build a multi-tenant SaaS application](https://blog.logto.io/build-multi-tenant-saas-application)
- [AI Lawyer — Car Rental Agreement Template](https://ailawyer.pro/blog/car-rental-agreement-template-the-complete-guide-for-owners-and-freelancers-in-2025)
- [PandaDoc — Car Rental Agreement Template](https://www.pandadoc.com/free-car-rental-agreement-template/)
- [VIPCars — How to read a car rental contract and avoid hidden fees](https://www.vipcars.com/guide/car-rental-tips/how-to-read-car-rental-contract)
- [Capterra — HQ Rental Software](https://www.capterra.com/p/156984/HQ-Rental-Software/)
- [SaaSWorthy — HQ Rental Software Features & Pricing](https://www.saasworthy.com/product/hq-rental-software)
- [Capterra — RentSyst](https://www.capterra.com/p/192757/RentSyst/)
- [Levy Electric Fleets — 80+ Car Rental & Car Sharing Software Platforms Compared](https://fleets.levyelectric.com/blog/best-car-rental-car-sharing-software)
- [Rentgine — Alerts feature](https://www.rentgine.net/en/features/alerts)
- [MCS Rental Software — Smart Alerts](https://www.mcsrentalsoftware.com/en/rental-software-systems/smart-alerts/)
- [Auto Rental News — National Car Rental Introduces Return Alerts](https://www.autorentalnews.com/news/national-car-rental-introduces-return-alerts-to-club-members)
- Internal: `.planning/PROJECT.md` (authoritative source for already-decided v1 scope, Active requirements, and Out of Scope items)

---
*Feature research for: Car rental / fleet-management SaaS dashboard (Wheelio Front, Algeria market)*
*Researched: 2026-07-22*
