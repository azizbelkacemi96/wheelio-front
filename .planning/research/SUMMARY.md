# Project Research Summary

**Project:** Wheelio Front
**Domain:** Role-based SaaS fleet-management dashboard (car rental agency ops tool, Algeria market) — pure SPA consuming an existing Go REST API
**Researched:** 2026-07-22
**Confidence:** MEDIUM-HIGH

## Executive Summary

Wheelio Front is a professional B2B dashboard for car-rental agency staff (agent/manager/owner) that closes the loop vehicle → customer → contract → état des lieux (damage inspection) → invoice, consuming the existing `wheelio-api` Go backend. This is the textbook case for a pure client-side SPA — no SEO, no public marketing pages, no need for server-rendered routes — so research strongly recommends **Vite + React 19 + TypeScript, TanStack Router + TanStack Query, shadcn/ui on Tailwind CSS v4, React Hook Form + Zod, i18next, Zustand** with no meta-framework (Next.js/Remix) involved. The architecture is a single role-aware shell over feature-module folders (`fleet`, `customers`, `rentals`, `inspections`, `billing`), with one shared permission utility sourced from the backend's `/me` Scope and one shared HTTP client owning JWT refresh — never three separate role-specific apps and never re-derived client-side role logic.

The single biggest risk cluster is the état des lieux (damage inspection) photo-capture flow performed in the field on mobile: EXIF photo-orientation bugs, iOS Safari camera-backgrounding data loss, and flaky-connectivity uploads must all be designed for from the start (per-photo incremental upload with retry, canvas-based EXIF correction, IndexedDB-backed local persistence) rather than retrofitted — this is explicitly the domain's highest-value feature (dispute prevention) and also its highest engineering risk. The second major risk is JWT refresh-token stampede: with rotating refresh tokens and concurrent dashboard requests, a naive per-request refresh implementation causes random logouts in production that never appear in single-request local testing — this must be solved with a single-flight refresh pattern in the HTTP client from day one, before any feature makes its first authenticated call.

The recommended mitigation strategy threads through the whole roadmap: build auth + a single role-aware shell + i18n architecture + design tokens first (foundations that are expensive to retrofit), then simple CRUD slices (fleet, customers) to establish data-layer conventions, then the stateful contract lifecycle, then the highest-risk inspection/photo-capture slice, then billing/PDF (reusing the already-proven authenticated-blob-download pattern). Confidence is MEDIUM-HIGH overall: the stack recommendations are verified live against npm/package sources (HIGH), while feature, architecture, and pitfall guidance is cross-checked across many independent 2025-2026 industry sources (MEDIUM) but not primary framework documentation — treat pitfalls/patterns as directional and validate against real devices (especially iOS Safari) during implementation.

## Key Findings

### Recommended Stack

Build a pure client-side SPA: Vite + React 19 + TypeScript, TanStack Router + TanStack Query for routing/server-state, shadcn/ui on Tailwind CSS v4 for the component system (full design control for a "this frontend IS the sales pitch" product), React Hook Form + Zod for forms/validation, i18next for FR/EN, and Zustand for the small amount of client-only UI state. Testing stack: Vitest + Testing Library for unit/component, Playwright for E2E, MSW for API mocking. No SSR/SSG — every reason to reach for Next.js/Remix (SEO, public pages, server API routes) is explicitly absent from this authenticated-only, backend-already-exists product.

**Core technologies:**
- React 19 + Vite + TypeScript (strict): industry-standard SPA foundation, fast HMR, lean static build for any host
- TanStack Router + TanStack Query: fully-typed routing and the 2026-consensus default for server-state (caching, invalidation, dedup) — owns everything that comes from `wheelio-api`
- shadcn/ui on Tailwind v4: copy-owned components, no imposed visual language, matches the requirement to define a bespoke professional SaaS identity
- React Hook Form + Zod: uncontrolled forms (important for the many-field inspection form), first-class Zod resolver integration
- i18next/react-i18next: mature, namespace-lazy-loadable i18n, must be wired with ICU plural/select support from day one

**Constrained tradeoff flagged for the roadmap:** the ideal JWT pattern (access in memory, refresh in an httpOnly cookie) is blocked because `wheelio-api`'s auth endpoints return both tokens as plain JSON (no `Set-Cookie`), and backend changes are out of scope. Use access-token-in-memory + refresh-token-in-localStorage as the best available compromise, with a strict CSP and short refresh TTL, and flag revisiting an httpOnly cookie as a future backend-touching security improvement.

### Expected Features

Scope matches PROJECT.md's golden path almost exactly: vehicle → customer → contract → inspection → close → invoice, plus fiscal-identity gating and bilingual FR/EN.

**Must have (table stakes / v1):**
- Vehicle list/detail with live status; overlap-proof booking UX (server-enforced, front surfaces friendly errors)
- Customer create/search (individual/business) + designated drivers
- Contract lifecycle: reservation → activation → closure → cancellation, made visible as a state machine
- Damage inspection (départ + retour): zone-based marking + photo capture, mobile-capable
- Fiscal identity setup as a hard blocking gate before invoice emission
- Billing: invoice view, manual payment recording, credit note, PDF download (contract/inspection/invoice)
- Role-aware navigation driven entirely by backend Scope (`/me` + JWT), never independently re-derived
- Agency switcher (owner role, multi-agency) and bilingual FR/EN UI from the first screen

**Should have (v1.1 differentiators):**
- Guided step-by-step "new rental" wizard tying the golden path into one flow (high leverage given the "démontrable de bout en bout" success metric — consider pulling into v1)
- Departure/return damage comparison view (side-by-side, requires both inspection points to exist first)
- Ops "today" overview (pickups/returns due) — cheap, high perceived value

**Defer (v2+):**
- Fleet availability calendar, utilization/revenue analytics, digital e-signature (needs backend work), return-reminder notifications, maintenance/document module UI (already exists in the API but explicitly deferred)
- Explicit anti-features: customer-facing booking portal, native mobile app, online payment gateway, AI damage detection, GPS/telematics, dynamic pricing, marketing/CRM, OTA integrations — all already correctly excluded per PROJECT.md.

### Architecture Approach

One `RequireAuth` layout route + one role-aware `AppShell` (never three separate role apps) sits above feature-module folders (`fleet`, `customers`, `rentals`, `inspections`, `billing`), each self-contained (api/queries/schemas/components/pages) and importing only from `shared/`, never from sibling features. A single `shared/api/client.ts` owns all JWT/HTTP concerns (auth header injection, single-flight 401 refresh) and a single `shared/auth/permissions.ts` is the only place that reads backend Scope — both are hard architectural constraints, not conveniences, because PROJECT.md explicitly forbids independent frontend role logic.

**Major components:**
1. Routing/Shell layer — auth guard + one parametrized role-aware `AppShell` rendering nav per Scope
2. Feature modules — vertical slices (fleet/customers/rentals/inspections/billing), each owning its own pages, query hooks, and Zod schemas
3. Data/server-state layer — TanStack Query hooks calling a typed API client with transparent single-flight refresh
4. Client/UI state layer — Zustand stores for auth scope, upload queue (per-photo state machine), and UI prefs (i18n/theme/toasts)

Two non-trivial patterns recur across features and must be built once, shared: (a) the two-step "upload then attach" photo state machine (`idle→uploading→uploaded→attaching→attached|failed`) for inspection photos, and (b) authenticated PDF blob-download (`fetch` with Bearer header → blob → object URL → programmatic `<a download>` click → revoke) since plain `<a href>`/`window.open` cannot carry the Authorization header.

### Critical Pitfalls

1. **Refresh-token stampede on concurrent 401s** — naive per-request refresh causes random production logouts once dashboard pages fire multiple parallel calls (rotating refresh tokens invalidate on the first refresh, later concurrent refreshes fail). Avoid with a single shared in-flight refresh promise + request queue in the HTTP client, built before any feature calls the API.
2. **Expired-token redirect destroys in-progress inspection work** — a hard "401 → /login" redirect mid-état-des-lieux loses captured photos/annotations that took real physical effort to gather. Avoid via invisible refresh (pitfall 1) plus IndexedDB-backed persistence of in-progress inspection state as defense in depth.
3. **EXIF orientation + iOS Safari camera-backgrounding bugs on inspection photos** — sideways damage photos or lost captures undermine the core trust-building value of the inspection feature. Avoid with canvas-based EXIF normalization on capture, synchronous `input.click()` triggering, and incremental per-photo upload with IndexedDB persistence, tested on a real iOS Safari device (not emulation).
4. **Client-side-only role checks mistaken for security / hiding vs. disabling inconsistently** — the backend already computes Scope (`CanRead/CanOperate/CanManage/IsOrgAdmin`); duplicating that logic client-side drifts from truth and a hidden-not-disabled action confuses users about broken vs. restricted. Avoid with one shared permission utility and a documented hide-vs-disable rule (hide only when truly irrelevant to the role; disable-with-tooltip otherwise).
5. **i18n retrofitted instead of architected / no design tokens from the start** — hardcoded strings and naive pluralization break French grammar (0/1 boundary, gendered nouns) and are expensive to fix later; ad hoc per-screen styling without a token set undermines the explicit "polished enough to be a sales argument" success metric. Both must be foundational (first phase), not emergent.

## Implications for Roadmap

Based on research, suggested phase structure (architecture dependencies plus pitfall-avoidance both point to the same order):

### Phase 1: Foundations — Auth, Shell, i18n, Design System
**Rationale:** Everything else depends on this; retrofitting auth, i18n, or design tokens onto existing screens is expensive and is explicitly the failure mode multiple pitfalls warn about.
**Delivers:** Login, JWT storage with single-flight refresh interceptor, route guards, one role-aware `AppShell`, FR/EN i18n wiring (ICU-based from the first string), a small design-token set (color/type/spacing scale) and 15-20 core components (buttons, inputs, cards, tables, badges, modals).
**Addresses:** Role-aware navigation, bilingual FR/EN (table stakes).
**Avoids:** Pitfall 1 (refresh stampede), Pitfall 5 (i18n retrofit / no design tokens), Pitfall 4 (role-check architecture) — the shared permission utility (`shared/auth/permissions.ts`) is built here.

### Phase 2: Fleet (Vehicles)
**Rationale:** Simplest CRUD slice; establishes TanStack Query hook conventions, query-key factories, and list/detail/table UI patterns reused by every later feature, on low-complexity domain data.
**Delivers:** Vehicle list with live status, vehicle detail (plate, model, mileage, fuel, current contract).
**Uses:** TanStack Router/Query, shadcn/ui table/badge components from Phase 1's token set.
**Implements:** Feature-module folder pattern (`features/fleet/`).

### Phase 3: Customers
**Rationale:** Same CRUD shape as fleet; hard dependency for contract creation (a rental needs a vehicle and a customer to exist).
**Delivers:** Individual/business customer create/search (duplicate-aware), designated additional drivers on a contract.
**Addresses:** Customer record + designated drivers (table stakes).

### Phase 4: Rentals (Contract Lifecycle)
**Rationale:** First genuinely stateful/workflow feature; depends on fleet + customers existing; establishes the status-machine UI pattern reused by inspections.
**Delivers:** Reservation → activation → closure → cancellation stepper, overlap-proof booking UX surfacing the backend's server-enforced rejection as a friendly error.
**Addresses:** Contract lifecycle, overlap-proof booking (table stakes).

### Phase 5: État des Lieux (Inspections)
**Rationale:** Depends on an active contract existing; this is the highest-complexity and highest-risk slice — build it once the CRUD/status-machine conventions are proven, per the architecture research's explicit sequencing recommendation.
**Delivers:** Départ/retour inspection, zone-based damage entry, mobile photo capture with canvas EXIF correction, per-photo upload-then-attach state machine, incremental upload with retry, IndexedDB persistence of in-progress capture.
**Addresses:** Damage inspection (table stakes); sets up damage comparison view as a v1.1 follow-on.
**Avoids:** Pitfalls 2, 3, 4 (field-photo-capture pitfalls) — this phase should be flagged for real-device (iOS Safari) testing during UAT, not emulator-only.

### Phase 6: Fiscal Identity + Billing
**Rationale:** Fiscal identity setup can be built in parallel with earlier phases (it only blocks billing, not fleet/customers/rentals/inspections) but is grouped here since it hard-gates invoice emission; depends on contract closure producing billing lines.
**Delivers:** Fiscal identity setup (NIF/NIS/RC/legal form, blocking gate), invoice view, manual payment recording, credit note issuance, authenticated PDF download (invoice/contract/inspection report) via the shared blob-download utility.
**Addresses:** Billing (table stakes); Fiscal identity gate (compliance-critical).
**Avoids:** Broken/insecure PDF download pattern — build the shared "download authenticated file" utility here since it's the first full exercise of that pattern (unless pulled forward earlier for validation).

### Phase Ordering Rationale

- Each phase's data model is a hard prerequisite for the next: vehicle+customer → contract → inspection → invoice (dependency graph from FEATURES.md and ARCHITECTURE.md's Suggested Build Order agree exactly).
- The two hardest UI problems (two-step photo upload/attach, authenticated PDF blob download) are deliberately pushed later, after simpler CRUD/list/detail/form conventions and the workflow/status-machine convention are already established, reducing the risk of building those hard patterns twice.
- Foundations (auth, i18n, design tokens, permission utility) are front-loaded because every pitfall analysis for this domain agrees: these are cheap to build first and expensive to retrofit after multiple feature phases already have ad hoc versions.
- The differentiator features (guided wizard, damage comparison, ops overview) are explicitly sequenced as v1.1 additions layered on top of already-shipped table-stakes screens, not new phases with new data dependencies.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (État des Lieux / Inspections):** highest technical risk — EXIF orientation handling, iOS Safari camera/backgrounding quirks, and resumable-upload patterns are device/browser-specific and under-documented in official sources; plan for real-device verification, not just code review.
- **Phase 6 (Fiscal Identity + Billing):** Algerian invoice compliance specifics (NIF/NIS/RC formatting, TVA rates, timbre fiscal rules) should be re-verified against current regulation at planning time — PROJECT.md is the current authority but compliance rules can shift.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundations):** well-documented, industry-standard patterns (JWT single-flight refresh, i18next ICU setup, design-token systems) with strong stack-research confidence already established here.
- **Phase 2 (Fleet) / Phase 3 (Customers):** standard CRUD/list/detail patterns using TanStack Query — no novel research needed.
- **Phase 4 (Rentals):** contract-lifecycle state machine is a well-understood UI pattern; the hard part (overlap prevention) is already solved server-side.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Framework/library versions verified live against the npm registry; qualitative comparisons (router/UI-kit choice) cross-checked across multiple independent 2025-2026 sources |
| Features | MEDIUM | Triangulated across rent-a-car SaaS vendor marketing sites and inspection-app vendors (industry-consensus, not primary docs); cross-checked against PROJECT.md, which is treated as the overriding authority |
| Architecture | MEDIUM | Patterns cross-checked across multiple independent 2025-2026 web sources; no official framework docs consulted directly for this dimension |
| Pitfalls | MEDIUM | Web-sourced, cross-checked across multiple independent articles per topic; directional guidance, especially for iOS Safari-specific behavior which should be validated on real devices during implementation |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- Whether mileage/fuel-level fields and billing charge types (overage, fuel, damage, extras) are already computed/exposed server-side or need front-end computation — confirm during requirements before finalizing whether contract-closure and billing can be separate phases.
- Whether backend PDF templates support per-org branding (logo/colors) — needed before promising the "branded PDF" v1.1 differentiator; requires a backend capability check.
- The JWT storage compromise (refresh token in localStorage) is an explicit, flagged tradeoff forced by the current API contract, not a first-choice pattern — revisit if any backend change (httpOnly cookie) becomes possible later.
- iOS Safari-specific photo-capture behavior (backgrounding, EXIF, synchronous click requirement) should be validated on real hardware early in Phase 5 planning, since emulators do not reproduce this class of bug.

## Sources

### Primary (HIGH confidence)
- npm registry (`registry.npmjs.org`) — live version lookups for the full recommended stack (React, Vite, TypeScript, TanStack Router/Query, React Hook Form, Zod, Tailwind, i18next, Zustand, Vitest, Playwright, ky)
- `wheelio-api` source (`internal/adapter/httpapi/auth_handler.go`, `document_handler.go`) — verified actual auth response shape (JSON tokens, no cookies) and existing multipart upload pattern
- `.planning/PROJECT.md` — authoritative source for already-decided v1 scope, Active requirements, Out of Scope items; overrides generic industry patterns wherever they conflict

### Secondary (MEDIUM confidence)
- Rent-a-car SaaS vendor sites (Booqable, RentSyst, HQ Rental Software, Rently Soft, AiRentoSoft, Rentgine, MCS Rental Software, VEVS) — feature landscape and competitor analysis
- Inspection-app vendors (Driveroo, GoCanvas, Sintel, Damage iD) — damage-inspection feature patterns
- Multi-tenant SaaS UX write-ups (WorkOS, Covio, Logto) — agency-switcher and RBAC-driven nav patterns
- JWT refresh-token race-condition and single-flight pattern articles (spiritcode.blog, dev.to series, luminary.blog) — refresh-stampede pitfall
- EXIF orientation and iOS Safari camera-input articles (Wassa, justmarkup, devnote.in, backdrop-issues) — photo-capture pitfalls
- Design-system/design-token guides (F1Studioz, Orbix, letsgroto) — design-consistency pitfall
- Architecture/folder-structure and routing articles (Robin Wieruch, WorkOS, namastedev, various Medium/dev.to) — project structure and route-guard patterns

### Tertiary (LOW confidence)
- None flagged separately — all sources above were cross-checked across multiple independent authors per topic per the researcher agents' methodology.

---
*Research completed: 2026-07-22*
*Ready for roadmap: yes*
