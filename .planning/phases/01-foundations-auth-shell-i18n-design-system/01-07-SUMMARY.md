---
phase: 01-foundations-auth-shell-i18n-design-system
plan: 07
subsystem: auth
tags: [tanstack-router, playwright, e2e, i18n, empty-state, placeholder-routes]

requires:
  - phase: 01-05
    provides: login-signup-screens, auth-feature-api-login-signup-logout
  - phase: 01-06
    provides: session-bootstrap-ensureSession, authenticated-route-guard, role-aware-app-shell-nav-topbar, owner-only-agency-switcher
provides:
  - shared-empty-state-component
  - base-placeholder-routes (/, /vehicules, /clients, /contrats, /etats-des-lieux)
  - admin-placeholder-routes (/admin/identite-fiscale, /admin/agences, /admin/facturation)
  - navrail-real-links-no-dead-ends
  - phase-e2e-happy-path (e2e/auth.spec.ts)
affects:
  - "Phase 2+ feature plans: each feature screen replaces its placeholder route's EmptyState with the real screen; EmptyState remains reusable for genuine zero-data states via key overrides"

tech-stack:
  added: [@playwright/test (first spec — e2e/auth.spec.ts; the runner/config existed since 01-01)]
  patterns:
    - "routeFileIgnorePattern: '\\\\.test\\\\.' is REQUIRED in BOTH scripts/generate-routes.mjs and vite.config.ts's tanstackRouter() plugin — the router generator has NO default ignore for .test. files, so a co-located vitest file inside src/routes/ would otherwise be treated as a route file. The two configs must stay in sync."
    - "Playwright-fulfilled cross-origin responses still pass through the browser's CORS checks (page :4173 -> API :8080) — every route.fulfill() mock must carry access-control-allow-* headers and OPTIONS preflights must be answered, or the app's ky requests fail exactly as a real misconfigured API would."
    - "E2E fixtures are imported from src/test/fixtures/scope.ts via a relative path — Playwright's babel transform strips scope.ts's type-only '@/'-aliased imports, so the same confirmed dto.go-shaped fixtures back both MSW (vitest) and page.route (Playwright) with zero duplication."
    - "Placeholder route files register the shared EmptyState directly as `component: EmptyState` — placeholders.test.tsx renders each route's Route.options.component (not a hand-built stand-in), so a route file drifting off the shared empty state fails the test."

key-files:
  created:
    - src/shared/ui/empty-state.tsx
    - src/routes/_authenticated/index.tsx
    - src/routes/_authenticated/vehicules.tsx
    - src/routes/_authenticated/clients.tsx
    - src/routes/_authenticated/contrats.tsx
    - src/routes/_authenticated/etats-des-lieux.tsx
    - src/routes/_authenticated/admin/identite-fiscale.tsx
    - src/routes/_authenticated/admin/agences.tsx
    - src/routes/_authenticated/admin/facturation.tsx
    - src/routes/_authenticated/placeholders.test.tsx
    - e2e/auth.spec.ts
  modified:
    - src/app/shell/NavRail.tsx
    - scripts/generate-routes.mjs
    - vite.config.ts
  deleted:
    - src/routes/_authenticated.index.tsx (git mv -> src/routes/_authenticated/index.tsx)

decisions:
  - "[Rule 3 - Blocking] Added routeFileIgnorePattern to both route-generator entry points — without it the plan-mandated co-located placeholders.test.tsx inside src/routes/ is picked up as a route file by @tanstack/router-generator (verified: no default .test. ignore exists in the installed generator's config schema)."
  - "E2E ran in MOCKED API mode (plan-sanctioned fallback): wheelio-api was not reachable at localhost:8080 at execution time, and the role-aware assertions require BOTH an owner and an agent account which a live DB cannot guarantee deterministically. Mocks are page.route() fulfillments of the same confirmed dto.go fixture shapes MSW uses."
  - "The 'Aujourd'hui' landing (_authenticated/index.tsx) renders the shared EmptyState like every other destination, per the must-have truth listing Aujourd'hui among the empty-state destinations — 01-06's interim heading-only placeholder replaced."
  - "NavRail's NavItemDef.to became a required literal-union NavPath — all 8 items are now typed <Link>s; the 01-06 toast-instead-of-navigating fallback branch (and its sonner import) deleted entirely."

requirements-completed: [AUTH-03, AUTH-05]

coverage:
  - id: D1
    description: "Every base nav destination (Aujourd'hui/Véhicules/Clients/Contrats/États des lieux) resolves to a real route rendering the shared i18n-driven EmptyState — no dead links, no blank pages"
    requirement: "AUTH-03"
    verification:
      - kind: unit
        ref: "src/routes/_authenticated/placeholders.test.tsx (all-routes-register-EmptyState test, 8 routes)"
        status: pass
      - kind: e2e
        ref: "e2e/auth.spec.ts (owner + agent scenarios navigate base sections and assert the placeholder)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The 3 admin placeholder routes exist under /admin/* and render the same EmptyState; nav-gated owner-only (D-09) — E2E asserts the agent sees no admin links and no agency switcher"
    requirement: "AUTH-03"
    verification:
      - kind: e2e
        ref: "e2e/auth.spec.ts ('agent: … NO admin sections and NO agency switcher' + owner admin navigation to /admin/agences)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Empty-state copy is locale-reactive: FR 'Bientôt disponible' hard default, EN 'Coming soon' live after switch — asserted at unit level (i18n.changeLanguage) AND in-browser via the TopBar language switcher"
    requirement: "AUTH-05"
    verification:
      - kind: unit
        ref: "src/routes/_authenticated/placeholders.test.tsx (FR-default + live FR->EN->FR switch tests)"
        status: pass
      - kind: e2e
        ref: "e2e/auth.spec.ts ('language switcher: FR default everywhere, EN copy live after switch')"
        status: pass
    human_judgment: false
  - id: D4
    description: "Phase top-level E2E happy path: /login -> credentials -> authenticated shell at '/' -> role-gated nav visible -> base section navigation shows the placeholder — headless, deterministic (mocked API)"
    requirement: "AUTH-03"
    verification:
      - kind: e2e
        ref: "e2e/auth.spec.ts (4/4 passing headless chromium)"
        status: pass
    human_judgment: false
  - id: D5
    description: "01-06's flagged human_judgment gap now automated: owner agency in-place switch — trigger updates to the selected agency, URL unchanged, ZERO additional /me or /auth/refresh calls (counted at the network-interception layer)"
    requirement: "AUTH-04 (carried gap from 01-06 D5)"
    verification:
      - kind: e2e
        ref: "e2e/auth.spec.ts ('owner: agency switch is in-place — no navigation reset, zero /me or /auth/refresh calls')"
        status: pass
    human_judgment: false
  - id: D6
    description: "01-06's flagged human_judgment gap now automated: language-switcher chrome — clicking the TopBar globe button live-switches nav labels, placeholder copy, and the switcher's own aria-label"
    requirement: "AUTH-05 (carried gap from 01-06 D6)"
    verification:
      - kind: e2e
        ref: "e2e/auth.spec.ts (language switcher scenario)"
        status: pass
    human_judgment: false

metrics:
  duration_minutes: 45
  completed: 2026-07-23
status: complete
---

# Phase 01 Plan 07: Placeholder Routes + E2E Happy Path Summary

Closed the shell loop: a shared i18n-driven `EmptyState` now backs 8 real placeholder routes (5 base + 3 owner-only admin), `NavRail`'s inert toast-buttons became typed `<Link>`s so no nav destination dead-ends, and a 4-scenario Playwright suite proves the whole phase headless — login → guarded shell → role-gated nav → locale-reactive placeholder — including the two interactions 01-06 had flagged as untested (owner agency in-place switch with zero session traffic, and the live language-switcher chrome).

## Performance

- **Duration:** ~45 min
- **Started:** 2026-07-23T11:22:54Z
- **Completed:** 2026-07-23T12:08:00Z (approx.)
- **Tasks:** 2
- **Files modified:** 15 (11 created, 3 modified, 1 moved/deleted)

## Accomplishments

- `src/shared/ui/empty-state.tsx`: presentational `EmptyState` — centered heading + body from i18n keys (`emptyState.heading`/`emptyState.body` defaults, overridable per-key for future genuine zero-data states). No hardcoded copy (plan prohibition).
- 5 base placeholder routes under `_authenticated/` (directory convention per the plan; the 01-06 flat `_authenticated.index.tsx` was `git mv`'d into `_authenticated/index.tsx`): `/` (Aujourd'hui), `/vehicules`, `/clients`, `/contrats`, `/etats-des-lieux` — each registering `EmptyState` directly as its component.
- 3 admin placeholder routes under `_authenticated/admin/`: `/admin/identite-fiscale`, `/admin/agences`, `/admin/facturation` — reachable only via the org-admin nav sections (D-09), never the base nav.
- `NavRail.tsx`: every item (5 base + 3 admin) is now a real typed `<Link>` with an active-state highlight; the 01-06 "Bientôt disponible" toast fallback and its `sonner` import are gone.
- `placeholders.test.tsx` (3 tests): FR copy by default, live FR→EN→FR switch, and an all-8-routes sweep rendering each route file's actual `Route.options.component` so drift off the shared empty state fails the suite.
- `e2e/auth.spec.ts` (4 scenarios, all passing headless): owner full happy path (login → shell → nav+admin+switcher → `/vehicules` and `/admin/agences` placeholders), agent role-gating (identical base nav, admin + switcher fully absent), owner in-place agency switch (URL unchanged, zero extra `/me`//`auth/refresh` — network-layer counters), and the FR-default/live-EN language switch.

## Task Commits

1. **Task 1: Shared EmptyState + base & admin placeholder routes**
   - `3574ef5` feat(01-07): shared EmptyState + base & admin placeholder routes (AUTH-03, AUTH-05)
2. **Task 2: End-to-end happy path (login -> shell -> role-gated nav)**
   - `c348a70` test(01-07): Playwright E2E happy path — login -> shell -> role-gated nav -> placeholder (AUTH-03, AUTH-05)

**Plan metadata:** committed separately (this SUMMARY + STATE.md/ROADMAP.md/REQUIREMENTS.md update)

## E2E Mode (per plan instruction to document)

**MOCKED API mode.** `wheelio-api` was not reachable at `http://localhost:8080` at execution time (connection refused). Additionally, the plan's role-aware assertions require both an owner *and* an agent account, which only fixtures can guarantee deterministically. The E2E intercepts every `VITE_API_URL` request via Playwright `page.route()` and fulfills with the exact same `src/test/fixtures/scope.ts` fixtures (typed against the confirmed `dto.go` shapes) that back the MSW handlers in vitest. Two mock-infrastructure specifics worth knowing:
- Fulfilled cross-origin responses still undergo browser CORS checks — the mocks answer `OPTIONS` preflights and attach `access-control-allow-*` headers.
- Credentials are dummy env-overridable fixture values (`E2E_EMAIL`/`E2E_PASSWORD`), never real secrets; no token is logged (T-01-e2e-secret mitigation).

Re-running against a live backend later requires only a running `wheelio-api` seeded with matching accounts and removing/conditioning the `mockApi()` calls.

## Files Created/Modified

- `src/shared/ui/empty-state.tsx` — shared `EmptyState` (i18n keys, overridable)
- `src/routes/_authenticated/index.tsx` — Aujourd'hui landing (moved from flat `_authenticated.index.tsx`, now renders `EmptyState`)
- `src/routes/_authenticated/{vehicules,clients,contrats,etats-des-lieux}.tsx` — base placeholders
- `src/routes/_authenticated/admin/{identite-fiscale,agences,facturation}.tsx` — owner-only placeholders
- `src/routes/_authenticated/placeholders.test.tsx` — 3 vitest tests (FR default / live switch / all-routes sweep)
- `src/app/shell/NavRail.tsx` — all items real typed `<Link>`s; toast fallback removed
- `scripts/generate-routes.mjs` + `vite.config.ts` — `routeFileIgnorePattern: "\\.test\\."` (kept in sync, see Deviations)
- `e2e/auth.spec.ts` — the phase happy-path E2E (4 scenarios)

## Decisions Made

- E2E in mocked mode (see "E2E Mode" above) — the plan's explicit fallback path.
- `_authenticated/index.tsx` renders the shared `EmptyState` (not 01-06's interim heading) per the must-have truth listing Aujourd'hui among the empty-state destinations.
- `NavItemDef.to` is a required literal-union (`NavPath`) — the router's `Register`-based `Link` typing verifies every nav target exists at compile time.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Router generator would treat the co-located test file as a route**
- **Found during:** Task 1, before creating `placeholders.test.tsx` at the plan-specified path inside `src/routes/`.
- **Issue:** `@tanstack/router-generator`'s config schema has NO default ignore for `.test.` files (verified in the installed package: only `routeFileIgnorePrefix: "-"` has a default; `routeFileIgnorePattern` is optional/unset). Generating with the test file present would add it to `routeTree.gen.ts` as a bogus route.
- **Fix:** Added `routeFileIgnorePattern: "\\.test\\."` to BOTH `scripts/generate-routes.mjs` (pregeneration path used by predev/prebuild/pretest hooks) and `vite.config.ts`'s `tanstackRouter()` plugin (dev/build path), with cross-referencing comments so they stay in sync.
- **Files modified:** `scripts/generate-routes.mjs`, `vite.config.ts`.
- **Verification:** `npm run generate-routes` → `routeTree.gen.ts` contains all 8 placeholder routes and zero references to `placeholders.test`.
- **Committed in:** `3574ef5`

**2. [Expected scope, documented for traceability] `NavRail.tsx` modified though not in the plan's `files_modified` list**
- **Found during:** Task 1 — the must-have truth "Every base nav destination resolves to a route … rather than a dead link" is unachievable while NavRail's non-Aujourd'hui items remain inert toast-buttons.
- **Issue/Fix:** Converted all 8 items to typed `<Link>`s (01-06's SUMMARY explicitly hands this conversion to 01-07: "01-07 is expected to add real placeholder routes … and wire NavRail's inert buttons to real `<Link>`s once those routes exist").
- **Files modified:** `src/app/shell/NavRail.tsx`.
- **Verification:** Full vitest suite (AppShell role-gating tests) + E2E navigation clicks.
- **Committed in:** `3574ef5`

---

**Total deviations:** 1 auto-fixed blocking issue + 1 anticipated-but-unlisted file modification. No scope creep — no feature functionality was built in any placeholder (plan prohibition upheld).

## Known Stubs

- All 8 placeholder routes intentionally render only `EmptyState` — that IS this plan's deliverable (the phase boundary explicitly excludes feature screens). Each later phase replaces its route's component: Véhicules (Phase 2), Clients (Phase 3), Contrats + Aujourd'hui dashboard (Phase 4), États des lieux (Phase 5), admin/facturation sections (Phase 6+).

## Threat Flags

None new. T-01-rbac disposition implemented as planned: admin placeholder routes are nav-gated only (the `/admin/*` URLs themselves are reachable by any authenticated user who types them — they contain zero data and zero actions this phase; backend re-authorises per-action when real admin features ship). The E2E asserts the agent sees no admin nav. T-01-e2e-secret: credentials are env-driven dummies; no token logged.

## Verification

- `npx tsc --noEmit`: exit 0.
- `npm run build`: exit 0.
- `npx vitest run`: 13 files, 64 tests, all passing (61 pre-existing + 3 new placeholder tests).
- `npx playwright test`: 4/4 passing (headless chromium, ~4s, mocked API mode).
- Full phase gate (`npx vitest run && npx playwright test`): green.

## Issues Encountered

None beyond the router-generator ignore-pattern gap (Deviations #1). The E2E suite passed on its first run.

## User Setup Required

None. (Optional: to re-run the E2E against a live backend, start `wheelio-api` on `VITE_API_URL` with seeded owner/agent accounts — the suite currently mocks the API and needs no backend.)

## Phase Completion

This was the final plan (7/7) of Phase 01. All phase success criteria now have automated proof: role-gated navigation (unit + E2E across owner/manager/agent fixtures), locale-reactive screens (unit + E2E), transparent session bootstrap with the single allowed redirect (unit + integration), and the top-level login→shell→nav→placeholder happy path (E2E). Outstanding human-verification items carried from 01-06 (hidden-endpoint 403/404 spot-check against a live backend; rendered FR/EN nav-label-length backstop) remain manual-only and are flagged for `/gsd-verify-work`.

---
*Phase: 01-foundations-auth-shell-i18n-design-system*
*Completed: 2026-07-23*

## Self-Check: PASSED

All 14 created/modified files verified present on disk (and the moved flat index route verified deleted); both task commits (3574ef5, c348a70) verified present in git log.
