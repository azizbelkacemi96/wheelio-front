---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 03
current_phase_name: clients
status: executing
stopped_at: Completed 03-03-PLAN.md
last_updated: "2026-07-28T08:22:30.265Z"
last_activity: 2026-07-28
last_activity_desc: Phase 03 execution started
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 14
  completed_plans: 13
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-22)

**Core value:** Une agence peut gérer tout son cycle de location — véhicule, client, contrat, état des lieux, facture — depuis une seule interface web professionnelle, aussi utilisable au comptoir que sur le terrain.
**Current focus:** Phase 03 — clients

## Current Position

Phase: 03 (clients) — EXECUTING
Plan: 4 of 4
Status: Ready to execute
Last activity: 2026-07-28 — Phase 03 execution started

Progress: [█████████░] 93%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: - min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 12 | 3 tasks | 23 files |
| Phase 01 P02 | 55 | 2 tasks | 19 files |
| Phase 01 P03 | 21 | 3 tasks | 6 files |
| Phase 01 P04 | 25 | 2 tasks | 5 files |
| Phase 01 P05 | 26 | 2 tasks | 8 files |
| Phase 01 P06 | 30 | 2 tasks | 18 files |
| Phase 01 P07 | 45 | 2 tasks | 15 files |
| Phase 02 P02 | 1 session | 2 tasks | 10 files |
| Phase 03 P01 | 25 | 3 tasks | 11 files |
| Phase 03 P02 | 8 | 3 tasks | 10 files |
| Phase 03 P03 | 15min | 3 tasks | 10 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Research]: Stack chosen — Vite + React 19 + TypeScript, TanStack Router/Query, shadcn/ui on Tailwind v4, React Hook Form + Zod, i18next, Zustand (see research/STACK.md).
- [Research]: JWT compromise — access token in memory + refresh token in localStorage, single-flight refresh interceptor, because `wheelio-api` returns both tokens as plain JSON (no httpOnly cookie support); revisit if backend ever adds cookie-based auth.
- [Roadmap]: PROJECT_MODE=standard (horizontal-layer/complete-feature phases) — each phase ships one fully complete requirement category, not thin vertical MVP slices.
- [Roadmap]: OPS-01 ("today" overview) folded into Phase 4 (Contrats de location) rather than a standalone phase — it depends on rental data and is too thin (1 requirement) to justify its own phase.
- [Phase ?]: Added scripts/generate-routes.mjs + npm postinstall/predev/prebuild/pretest hooks to fix a bare-clone build break (routeTree.gen.ts chicken-and-egg with tsc -b)
- [Phase ?]: Added @types/react + @types/react-dom (not in 01-RESEARCH.md install list) — required for TypeScript 7 to resolve React's module shape
- [Phase ?]: shadcn CLI v4.14.0 replaced the style/baseColor init paradigm with presets (Nova/Vega/.../Custom) + base library (base/radix/aria) — ran init with --base radix and the nova preset, then hand-mapped 01-UI-SPEC.md's exact token values onto the generated CSS variable names (architecture unaffected, only the CLI invocation differed)
- [Phase ?]: shadcn's official registry replaced form.tsx with field.tsx (framework-agnostic Field/FieldLabel/FieldError primitives) — vendored field.tsx; Plan 03's login/signup forms will compose Field/FieldError with React Hook Form's fieldState.errors directly
- [Phase ?]: Fixed a Node 22+/jsdom incompatibility (experimental global localStorage shadows window.localStorage in Vitest workers) via vitest.config.ts execArgv — required for theme-provider.test.tsx and every future test touching localStorage (e.g. Plan 03's auth store)
- [Phase ?]: ky installed is v2.0.2 (major version ahead of 01-RESEARCH.md's v1-style Pattern 1 sample) — client.ts rewritten against ky v2's confirmed API: baseUrl replaces prefixUrl, hooks receive a destructured {request,response,retryCount} object, and ky.retry({request,code}) is used for the single forced retry (bypasses the default retry methods allow-list, confirmed via ky source, so POST/PUT also get the retry).
- [Phase ?]: currentAgencyId is not persisted this phase (flagged assumption from 01-RESEARCH.md A1/OQ1) — resets to null on reload; callers default to the org's first agency.
- [Phase ?]: [Phase 01-04]: Restricted i18next-browser-languagedetector's detection.order to ['localStorage'] only (excluding navigator/cookie/querystring/htmlTag) so FR is a true hard default -- the default detector order would otherwise let the browser's Accept-Language override fallbackLng 'fr' on a fresh session with nothing stored.
- [Phase ?]: [Phase 01-04]: EN admin-section nav labels (fiscal identity/agency management/cross-agency billing) are not verbatim-specified in 01-UI-SPEC.md; used CONTEXT.md's English paraphrase directly as the EN copy -- flagged for confirmation.
- [Phase ?]: [Phase 01-05]: login()/signup() use a bare ky request instead of the shared refresh-interceptor client -- routing an unauthenticated 401 credentials failure through the refresh hook would misfire (unrelated token refresh or a confusing 'no refresh token' error instead of the real login failure).
- [Phase ?]: [Phase 01-05]: Extended Plan 04's i18n copy inventory with field-label/placeholder/cross-link/generic-error auth.* keys -- the inventory only covered CTA + error strings, not the actual form labels this plan's own 'no bare JSX literals' prohibition requires.
- [Phase ?]: [Phase 01-06]: Toasting 'Session expirée' from beforeLoad silently drops the toast (RouterProvider defers committing __root.tsx's <Toaster/> until the first navigation settles) -- moved the toast to /login's own mount effect via a reason=session-expired search param, and reordered __root.tsx to render <Toaster/> before <Outlet/> (React fires effects depth-first in JSX order).
- [Phase ?]: [Phase 01-06]: Moved the previously-public src/routes/index.tsx under _authenticated (as _authenticated.index.tsx) -- leaving '/' unguarded would have meant AUTH-02's guard never actually applied to the app's own home route.
- [Phase ?]: [Phase 01-06]: Added a display-only user field (first_name/last_name/email) to the Zustand auth store, populated alongside setScope -- permissions.ts's Scope deliberately carries no display data (literal port of scope.go), so the user-menu name requirement needed a home elsewhere.
- [Phase ?]: [Phase 01-07]: Added routeFileIgnorePattern '\.test\.' to BOTH scripts/generate-routes.mjs and vite.config.ts's tanstackRouter plugin — the router generator has no default ignore for .test. files, so co-located vitest files inside src/routes would otherwise be generated as routes.
- [Phase ?]: [Phase 01-07]: Phase E2E ran in MOCKED API mode (plan-sanctioned fallback) — wheelio-api unreachable at execution time, and owner+agent role assertions need deterministic fixtures; Playwright page.route mocks reuse src/test/fixtures/scope.ts with CORS headers + OPTIONS preflight handling (fulfilled cross-origin responses still undergo browser CORS checks).
- [Phase ?]: 02-02: Vehicle list uses server-side ?status= filter (in query key) + client-side useMemo text search; responsive table(md+)/cards(<md) both in DOM
- [Phase ?]: 02-02: Created $vehicleId stub route as the typed link target (02-03 fills VehicleDetail); routeTree.gen.ts is gitignored, not committed
- [Phase ?]: 03-01: hasOrgRole ported as a separate org-wide axis alongside per-agency canOperate/canRead/canManage — customer records use HasOrgRole, never the per-agency gate
- [Phase ?]: 03-01: customer query keys carry no currentAgencyId — customers are org-scoped, contrasting with fleet's agency-keyed list
- [Phase ?]: 03-01: MSW driver-create-with-unknown-parent returns 400 'unknown customer', mirroring service.go's ErrNotFound->ErrInvalid mapping
- [Phase ?]: 03-02: Pulled the $customerId typed stub route forward from 03-03 (Rule 3) — CustomerList's row Link needs a registered route target to type-check under tsc -b, mirroring 02-02's vehicules/$vehicleId precedent
- [Phase ?]: 03-02: Server-side ?q= search implemented via two local useState values (raw input + debounced-committed) rather than a shared debounce hook — no such hook exists yet and CustomerList is the only caller
- [Phase ?]: 03-03: License fields render only in the individual branch UI (a company has no personal license, only its drivers do)
- [Phase ?]: 03-03: Radix RadioGroup/Select wired via react-hook-form Controller (value/onValueChange), not register()
- [Phase ?]: 03-03: translatedError(t, fieldError) helper resolves i18n-key Zod messages before FieldError renders them (first form whose schema messages are keys, not bare strings)
- [Phase ?]: 03-03: Partial-failure retry re-attaches only the previously-failed driver rows against the existing customer id; onSubmit guards against ever re-POSTing /customers once a customer exists

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 5 (État des lieux) is the highest-risk phase — EXIF photo orientation, iOS Safari camera-backgrounding, and resumable-upload patterns need real-device validation (not emulator-only) per research/PITFALLS.md.
- Phase 6 (Facturation) fiscal-identity/invoice compliance details (NIF/NIS/RC formatting, TVA rates, timbre fiscal) should be re-verified against current Algerian regulation at planning time.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-07-28T08:22:30.259Z
Stopped at: Completed 03-03-PLAN.md
Resume file: None
