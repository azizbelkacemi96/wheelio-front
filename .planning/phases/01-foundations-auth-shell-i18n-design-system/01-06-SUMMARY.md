---
phase: 01-foundations-auth-shell-i18n-design-system
plan: 06
subsystem: auth
tags: [tanstack-router, tanstack-query, zustand, react-i18next, shadcn, rbac, session]

requires:
  - phase: 01-03
    provides: permissions-ts-rbac-port, zustand-auth-store, single-flight-refresh-api-client
  - phase: 01-05
    provides: login-signup-screens, auth-feature-api-login-signup-logout
provides:
  - session-bootstrap-ensureSession
  - authenticated-route-guard
  - role-aware-app-shell-nav-topbar
  - owner-only-agency-switcher
affects:
  - "01-07 (placeholder routes + e2e): AppShell/NavRail/TopBar are the shell every placeholder feature route mounts into via _authenticated's <Outlet/>; the login->shell->role-nav happy path this plan wires is 01-07's e2e entry point"

tech-stack:
  added: [@tanstack/react-query (first usage — QueryClientProvider + agency-list useQuery)]
  patterns:
    - "shared/auth/session.ts: ensureSession() is a two-outcome contract, not a single Scope|null return read literally — it RESOLVES to null only when refresh itself fails (the ONE case _authenticated's beforeLoad redirects on) and REJECTS (does not resolve null) when a valid access token's subsequent /me call fails, so the guard can tell 'not logged in' apart from 'logged in, profile temporarily unavailable' and never bounce an authenticated user back to /login for the latter."
    - "AppShell owns its own /me retry independently of beforeLoad: it calls ensureSession() again on mount (a no-op fast path via the memoised Scope when beforeLoad already succeeded) so it can render a real loading skeleton -> error-banner-with-Retry progression for the /me-only-failure case beforeLoad deliberately swallows rather than redirects on."
    - "The 'Session expirée' toast fires from /login's OWN mount effect (reading a `reason=session-expired` search param set by the redirect), not from beforeLoad itself — RouterProvider does not commit __root.tsx's tree (including <Toaster/>) until the first navigation's beforeLoad chain settles, so a toast fired from inside beforeLoad on a fresh page load has no subscriber yet and is silently lost. See Deviations."
    - "__root.tsx renders <Toaster/> BEFORE <Outlet/> — React fires effects depth-first in JSX declaration order; a toast-on-mount route nested inside Outlet would otherwise run its effect before Toaster's own subscribing effect, dropping the toast the same way as above."
    - "NavRail items without a real route this phase (Véhicules/Clients/Contrats/États des lieux + the 3 admin sections) render as plain buttons that toast the 'Bientôt disponible' empty-state copy on click, not as TanStack Router <Link>s — those routes don't exist until 01-07, and a typed Link to a non-existent path fails tsc under this router's Register-based type inference."

key-files:
  created:
    - src/shared/auth/session.ts
    - src/shared/auth/session.test.ts
    - src/app/router.tsx
    - src/app/router.test.tsx
    - src/app/providers.tsx
    - src/routes/_authenticated.tsx
    - src/routes/_authenticated.index.tsx
    - src/app/shell/AppShell.tsx
    - src/app/shell/AppShell.test.tsx
    - src/app/shell/NavRail.tsx
    - src/app/shell/TopBar.tsx
  modified:
    - src/main.tsx
    - src/routes/__root.tsx
    - src/routes/login.tsx
    - src/shared/auth/store.ts
    - src/shared/i18n/fr/common.json
    - src/shared/i18n/en/common.json
    - src/test/setup.ts
  deleted:
    - src/routes/index.tsx

decisions:
  - "[Rule 1 - Bug] Toasting 'Session expirée' from inside _authenticated.tsx's beforeLoad silently loses the toast on a fresh page load — RouterProvider defers committing __root.tsx's <Toaster/> until the first navigation's beforeLoad chain resolves, so a toast fired mid-beforeLoad has no subscriber yet. Fixed by redirecting with a `reason=session-expired` search param and having /login's own mount effect fire the toast instead (always mounted by the time its component runs)."
  - "[Rule 1 - Bug] __root.tsx now renders <Toaster/> before <Outlet/> — same root cause as above, one level deeper: React fires effects depth-first in JSX order, so a toast-on-mount child route could still race Toaster's own subscribing effect if it were the later sibling."
  - "[Rule 2 - Missing critical functionality] The pre-existing src/routes/index.tsx was a fully PUBLIC, unguarded placeholder at '/' — moved it under _authenticated (as _authenticated.index.tsx) since leaving it public would mean the entire AUTH-02 guard this plan builds never actually applies to the app's own home route. 01-07 replaces this placeholder child with the real 'Aujourd'hui' dashboard."
  - "[Rule 2 - Missing critical functionality] Added a display-only `user` field (first_name/last_name/email) to the Zustand auth store, populated by session.ts's bootstrap alongside setScope. Scope (permissions.ts) deliberately carries NO display data — it stays a literal, display-free port of wheelio-api's scope.go — so the user-menu's name requirement (must_haves: 'the user menu shows name + role from Scope') had nowhere else to source a display name from."
  - "[Rule 3 - Blocking issue] Added a window.matchMedia stub to src/test/setup.ts — sonner's Toaster reads prefers-color-scheme directly via matchMedia when its theme prop resolves to 'system' (ThemeProvider's own default), and jsdom has no implementation; router.test.tsx is the first test to ever mount the real __root.tsx tree."
  - "NavRail's 5 base items + 3 admin items reference only the one route that exists this phase ('/' for Aujourd'hui); the rest render as inert buttons that toast the empty-state copy rather than using a typed <Link> to a route 01-07 hasn't created yet — building those placeholder ROUTES is explicitly 01-07's scope, not this plan's."

requirements-completed: [AUTH-02, AUTH-03, AUTH-04]

coverage:
  - id: D1
    description: "session.ts's ensureSession() — memoised refresh-if-needed + single /me bootstrap; resolves null ONLY on genuine refresh failure, rejects (not null) on a /me-only failure with a valid token"
    requirement: "AUTH-02"
    verification:
      - kind: unit
        ref: "src/shared/auth/session.test.ts (7 tests: refresh+me-once, concurrent-memoisation, skip-refresh-with-existing-token, null-on-refresh-failure, null-with-no-refresh-token, reject-on-me-failure, resetSession-retry)"
        status: pass
    human_judgment: false
  - id: D2
    description: "_authenticated.tsx's beforeLoad guard — refresh success renders the shell with no redirect; refresh failure redirects to /login with the 'Session expirée' copy (via a search-param-driven toast on /login's own mount, not at redirect time)"
    requirement: "AUTH-02"
    verification:
      - kind: integration
        ref: "src/app/router.test.tsx (2 tests: refresh-success-no-redirect, refresh-failure-redirect-with-session-expired-copy)"
        status: pass
    human_judgment: false
  - id: D3
    description: "AppShell — skeleton while /me resolves, full-shell error banner + Retry on /me failure (never a silently empty/guessed nav), NavRail+TopBar+Outlet on success"
    requirement: "AUTH-02, AUTH-03"
    verification:
      - kind: unit
        ref: "src/app/shell/AppShell.test.tsx (loading-skeleton-then-nav, error-banner-then-retry-succeeds)"
        status: pass
    human_judgment: false
  - id: D4
    description: "NavRail — base nav (Aujourd'hui/Véhicules/Clients/Contrats/États des lieux) identical for agent/manager/owner (D-08); the 3 admin sections render ONLY for the org-admin owner and are fully absent (not disabled) for agent/manager (D-09), gated by isOrgAdmin(scope) from permissions.ts"
    requirement: "AUTH-03"
    verification:
      - kind: unit
        ref: "src/app/shell/AppShell.test.tsx > AppShell — role-gated nav (2 tests: base-nav-identical-across-roles, admin-sections-owner-only)"
        status: pass
    human_judgment: false
  - id: D5
    description: "TopBar's owner-only agency switcher — GET /agencies via TanStack Query, current selection accent-marked, selecting an agency calls setCurrentAgency with zero /me or /auth/refresh calls and no navigation reset (D-10/D-11)"
    requirement: "AUTH-04"
    verification: []
    human_judgment: true
    rationale: "No dedicated interaction test drives the dropdown open + selects a different agency + asserts zero /me/refresh network calls and unchanged route; store.ts's existing setCurrentAgency unit test (Plan 03) already proves the underlying pure-state-write property, and AppShell's role tests prove the switcher is absent for non-admins, but the specific in-place-switch behavior for the owner fixture is unverified by an automated test this execution — flagged for human/E2E verification (01-07)."
  - id: D6
    description: "TopBar's language switcher (icon + 2-letter code) and user menu (name + role from the new store.user field, logout last/divider-separated/immediate/not-destructive-styled)"
    requirement: "AUTH-03"
    verification: []
    human_judgment: true
    rationale: "No automated test opens the user menu and asserts logout's position/styling or exercises the language toggle from within the shell (i18n's own switching behavior was already unit-tested in Plan 04); this plan's tests focus on the role-gating and session-state coverage the must-have truths emphasize, leaving these two chrome elements' exact interaction unverified here."
  - id: D7
    description: "Icon-only nav control accessibility — aria-label + tooltip fallback on the mobile Sheet trigger and the language switcher, 44x44 min hit area on touch/mobile icon-only controls"
    requirement: "AUTH-03"
    verification: []
    human_judgment: true
    rationale: "Structural only (Tailwind min-h-11/min-w-11 classes + aria-label/Tooltip JSX present in TopBar.tsx) — no rendered/visual or axe-style accessibility check was run this execution; matches the UI-SPEC's own Checker Sign-Off FLAG (non-blocking, declare-before/during-planning) rather than a fully automated-verified truth."

metrics:
  duration_minutes: 30
  completed: 2026-07-23
status: complete
---

# Phase 01 Plan 06: Role-Aware Shell Summary

Wired the `_authenticated` route guard (memoised `ensureSession()` bootstrap: refresh-if-needed + single `/me`, redirecting to `/login` only on a genuine refresh failure) and built the `AppShell`/`NavRail`/`TopBar` chrome that reads the resolved `Scope` to render an identical base nav across all three roles, fully hide the three owner-only admin sections for agent/manager, and expose an in-place owner-only agency switcher — fixing along the way a toast-timing bug where `RouterProvider` never gives `beforeLoad`'s toast a subscriber to land on.

## Performance

- **Duration:** ~30 min
- **Started:** 2026-07-23T10:33:00Z (approx.)
- **Completed:** 2026-07-23T11:01:00Z
- **Tasks:** 2
- **Files modified:** 18 (11 created, 6 modified, 1 deleted)

## Accomplishments

- `session.ts`: `ensureSession()` — the memoised session bootstrap every entry point (route guard, `AppShell`'s own retry) shares. Refresh only runs if no access token is already in memory (a fresh login skips it entirely); a refresh failure resolves to `null` (the one redirect case); a `/me` failure with an otherwise-valid token REJECTS instead, letting callers distinguish "not logged in" from "logged in, profile temporarily unavailable."
- `_authenticated.tsx` + `_authenticated.index.tsx`: the auth guard layout route (`beforeLoad` redirects to `/login?reason=session-expired` only on that `null`) with a minimal placeholder child at `/` — the previously fully-public `index.tsx` is now guarded, closing a gap where this plan's entire purpose would otherwise have had no effect on the app's own home route.
- `router.tsx` / `providers.tsx` / `main.tsx`: the composition root — `QueryClientProvider` (first use of TanStack Query in this codebase, for the agency list) + `ThemeProvider` + `TooltipProvider` + the i18n side-effect import + the guarded `RouterProvider`.
- `AppShell.tsx`: retries `ensureSession()` on mount (a zero-cost no-op when the guard already succeeded), rendering a loading skeleton, a full-shell error banner + "Réessayer"/"Retry" on `/me` failure, or `NavRail` + `TopBar` + `Outlet` on success — never redirecting itself.
- `NavRail.tsx`: the 5-item base nav renders identically for agent/manager/owner (D-08); the 3 admin sections (`Identité fiscale société`/`Gestion agences`/`Facturation transverse`) render only when `isOrgAdmin(scope)`, fully absent otherwise (D-09) — proven by fixture-driven tests for all three roles.
- `TopBar.tsx`: owner-only agency switcher (`GET /agencies` via `useQuery`, accent-checkmarked current selection, `setCurrentAgency` with zero `/me`/`/auth/refresh` calls — D-10/D-11), language switcher (icon + 2-letter code via `useLocale`), and user menu (name + role, logout last/divider-separated/immediate/not-destructive-styled) plus a mobile `Sheet` nav drawer with an aria-labelled + tooltipped trigger.
- Fixed a genuine toast-timing bug (see Deviations) discovered while writing `router.test.tsx`: `RouterProvider` does not commit `__root.tsx`'s tree — including its `<Toaster/>` — until the very first navigation's `beforeLoad` chain settles, so firing the "Session expirée" toast from inside `beforeLoad` itself would silently vanish on a fresh page load in the REAL app, not just in tests.

## Task Commits

1. **Task 1: Provider composition + auth-guarded router + session bootstrap**
   - `442833b` feat(01-06): auth-guarded router + session bootstrap (AUTH-02)
2. **Task 2: AppShell + NavRail (role nav) + TopBar (agency/language/user)**
   - `b6d3878` feat(01-06): AppShell + role-gated NavRail + TopBar (AUTH-02, AUTH-03, AUTH-04)

**Plan metadata:** committed separately (this SUMMARY + STATE.md/ROADMAP.md/REQUIREMENTS.md update)

## Files Created/Modified

- `src/shared/auth/session.ts` / `session.test.ts` — `ensureSession()`/`resetSession()`, 7 tests
- `src/app/router.tsx` / `router.test.tsx` — guarded router construction, 2 integration tests against the real `routeTree.gen.ts`
- `src/app/providers.tsx` — composition root
- `src/main.tsx` — rewritten to mount `<Providers/>`
- `src/routes/__root.tsx` — root layout, `<Toaster/>` before `<Outlet/>`, router context type
- `src/routes/_authenticated.tsx` / `_authenticated.index.tsx` — the guard + its minimal placeholder child
- `src/routes/login.tsx` — reads `reason=session-expired` search param, toasts on its own mount
- `src/routes/index.tsx` — **deleted** (superseded by the guarded `_authenticated.index.tsx`)
- `src/app/shell/AppShell.tsx` / `AppShell.test.tsx` — the shell, 4 tests (2 role-gating covering all 3 role fixtures, 2 loading/error)
- `src/app/shell/NavRail.tsx` — role-gated nav list
- `src/app/shell/TopBar.tsx` — agency switcher, language switcher, user menu, mobile nav trigger
- `src/shared/auth/store.ts` — added `user`/`setUser` (display-only)
- `src/shared/i18n/fr/common.json`, `en/common.json` — added `nav.mainLabel`, `shell.logout`/`userMenu`/`agencySwitcher`/`languageSwitcher`/`openNav`, `roles.*`
- `src/test/setup.ts` — added a `window.matchMedia` stub

## Decisions Made

- `ensureSession()`'s resolve-null-vs-reject split is the load-bearing design decision this plan hinges on — it is what lets a route guard (redirect-worthy) and a component-level retry (banner-worthy) share one function without conflating the two failure modes. See Deviations for the full reasoning.
- Session-expiry toast moved from `beforeLoad` to `/login`'s own mount (Rule 1 fix) — a genuine bug found via `router.test.tsx`, not a style preference.
- `index.tsx` moved under `_authenticated` (Rule 2) — the guard would otherwise have zero effect on the app's actual home route.
- Store gained a display-only `user` field (Rule 2) — `permissions.ts`'s `Scope` intentionally has no display data, so the user-menu name requirement needed a home elsewhere.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Toasting "Session expirée" from inside `beforeLoad` silently loses the toast**
- **Found during:** Task 1, writing `router.test.tsx`'s refresh-failure assertion.
- **Issue:** `RouterProvider` does not commit ANY of `__root.tsx`'s component tree — including its `<Toaster/>` — until the first navigation's `beforeLoad` chain fully resolves. Calling `toast.error(...)` from inside `_authenticated.tsx`'s `beforeLoad` on a fresh page load therefore fires into a sonner store with no subscriber yet; the toast is silently dropped. This is a real bug, not a test artifact — it would reproduce identically on a genuine browser hard-refresh with an expired refresh token.
- **Fix:** `_authenticated.tsx`'s redirect now carries `search: { reason: "session-expired" }`; `/login`'s own component reads that search param via `Route.useSearch()` and fires the toast in its OWN mount `useEffect` — by which point the whole tree (including `<Toaster/>`) is definitely committed.
- **Files modified:** `src/routes/_authenticated.tsx`, `src/routes/login.tsx`.
- **Verification:** `router.test.tsx`'s "refresh failure" test asserts both the redirect AND the visible "Session expirée" text.
- **Committed in:** `442833b`

**2. [Rule 1 - Bug] `<Outlet/>` before `<Toaster/>` in `__root.tsx` races the same failure mode one level deeper**
- **Found during:** Task 1, same debugging session as #1 above (the search-param fix alone did not resolve the failing test until this was also fixed).
- **Issue:** React fires `useEffect`s depth-first in JSX declaration order. With `<Outlet/><Toaster/>` (original order), a route nested inside `Outlet` that toasts on mount (the fixed `/login` from #1) has its effect run BEFORE `Toaster`'s own subscribing effect, since `Outlet`'s subtree is fully processed before its later sibling `Toaster`. The toast is dropped for the same underlying reason as #1, one JSX-ordering level down.
- **Fix:** Reordered `__root.tsx` to `<Toaster/><Outlet/>`.
- **Files modified:** `src/routes/__root.tsx`.
- **Verification:** Same `router.test.tsx` test as #1 — only passes with both fixes combined.
- **Committed in:** `442833b`

**3. [Rule 2 - Missing critical functionality] `src/routes/index.tsx` was fully public and unguarded**
- **Found during:** Task 1, wiring `_authenticated.tsx` — realized the pre-existing top-level `index.tsx` (from Plan 01) still matched `/` publicly, meaning the guard this plan builds would have zero effect on the app's own home route.
- **Issue:** A pathless layout route (`_authenticated`) only takes over a URL when a CHILD route claims that path; without moving `/` under it, both the guard and every future `AppShell`-mounted feature route would be unreachable via the app's actual entry point.
- **Fix:** Deleted `src/routes/index.tsx`; created `src/routes/_authenticated.index.tsx` as a minimal placeholder child (01-07 replaces its content with the real "Aujourd'hui" dashboard).
- **Files modified:** `src/routes/index.tsx` (deleted), `src/routes/_authenticated.index.tsx` (new).
- **Verification:** `router.test.tsx`'s refresh-success test asserts the shell (not the old public placeholder) renders at `/`.
- **Committed in:** `442833b`

**4. [Rule 2 - Missing critical functionality] `Scope` has no display name, but the user menu must show one**
- **Found during:** Task 2, building `TopBar.tsx`'s user menu per the must-have truth "the user menu shows name + role from Scope."
- **Issue:** `permissions.ts`'s `Scope` interface (Plan 03) is a literal, display-free port of `scope.go` — `userId`/`orgId`/`orgRole`/`agencyRoles` only, no name/email. Extending `Scope` itself would break its documented "literal port" invariant.
- **Fix:** Added a separate `user: DisplayUser | null` field (`first_name`/`last_name`/`email`) to the Zustand store, populated by `session.ts`'s bootstrap in the same `/me` call that resolves `Scope` — kept deliberately distinct from `Scope` so authorization logic never has a reason to read it.
- **Files modified:** `src/shared/auth/store.ts`, `src/shared/auth/session.ts`.
- **Verification:** `AppShell.test.tsx`'s role tests exercise the full render path including `TopBar`/`UserMenu`; no crash/missing-name regression.
- **Committed in:** `b6d3878`

**5. [Rule 3 - Blocking issue] jsdom has no `window.matchMedia`**
- **Found during:** Task 1, first run of `router.test.tsx` (the first test in this codebase to mount the real `__root.tsx` tree, including `<Toaster/>`).
- **Issue:** `sonner`'s `Toaster` reads `prefers-color-scheme` via `window.matchMedia` when its `theme` prop resolves to `"system"` (the `ThemeProvider` default); jsdom has no implementation, crashing with `window.matchMedia is not a function`.
- **Fix:** Added a minimal `matchMedia` stub to `src/test/setup.ts` (shared test infra, not per-file) so any future test exercising the real app tree doesn't have to rediscover this.
- **Files modified:** `src/test/setup.ts`.
- **Verification:** `router.test.tsx` and `AppShell.test.tsx` (both render component trees under `TooltipProvider`, but only `router.test.tsx` mounts the real `__root.tsx`) pass; full suite green.
- **Committed in:** `442833b`

---

**Total deviations:** 5 auto-fixed (2 Rule 1 bugs, 2 Rule 2 missing-functionality, 1 Rule 3 blocking-issue).
**Impact on plan:** All five were necessary for this plan's own must-have truths (AUTH-02's redirect discipline with visible copy; a guard that actually applies to `/`; a user menu that can show a name) or to unblock test execution entirely. No scope creep — no feature routes beyond the guarded placeholder were built (that remains 01-07's scope).

## Known Stubs

- `NavRail`'s 4 non-"Aujourd'hui" base items and all 3 admin items have no destination route this phase — clicking them shows the "Bientôt disponible"/"Coming soon" empty-state toast rather than navigating. This is intentional and matches the phase boundary ("no feature screens are built here") — 01-07 is expected to add the actual placeholder routes and wire these to real `<Link>`s.
- `_authenticated.index.tsx`'s dashboard content is a one-line placeholder heading, not the real "Aujourd'hui" overview (that's Phase 4/OPS-01's scope entirely, well beyond 01-07).

## Threat Flags

None beyond what 01-06-PLAN.md's own threat model already covers. T-01-rbac (nav visibility is UX-only, backend re-authorizes) — the human-check spot-verifying a hidden owner-only endpoint returns 403/404 for a non-admin token was NOT performed this execution (requires a live backend + real per-role tokens); flagged below as a manual verification gap, consistent with D5/D6/D7's `human_judgment: true` entries above.

## Verification

- `npx vitest run --reporter=dot` (full suite): 12 files, 61 tests, all passing (48 pre-existing from Plans 01–05 + 13 new: 7 in `session.test.ts` + 2 in `router.test.tsx` + 4 in `AppShell.test.tsx`).
- `npx tsc --noEmit`: exit 0.
- `npm run build`: exit 0 (new chunks: `_authenticated-*.js` 63.5kB, `session-*.js` bundled with client/agencies query code, `_authenticated.index-*.js` 0.35kB).
- Manual-only (NOT performed this execution, per 01-06-PLAN.md's own verification section): the hidden-button direct-API spot-check (confirm agent/manager tokens get 403/404 on an owner-only backend endpoint despite the nav hiding the button) — this requires a live `wheelio-api` instance + real per-role JWTs, out of reach for this non-interactive execution. Flagged for human verification before/alongside 01-07's E2E pass.
- Backstop (FR/EN nav label-length, 01-UI-SPEC.md): not rendered-checked this execution — structural only (both label sets are short single-line phrases; no wrap/truncate CSS override applied). Flagged `insufficient_spec until confirmed`, consistent with Plan 05's precedent for backstop items.

## Issues Encountered

The toast-timing bug (Deviations #1/#2) was the only non-trivial issue — see above for full root-cause and fix. Everything else matched the plan's design once that was resolved.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness — E2E Blockers Assessment (01-07)

**Nothing blocking.** The login → shell → role-gated-nav happy path 01-07's E2E test needs is fully wired and green end-to-end:
- Login (Plan 05) stores tokens and navigates to `/`.
- `/` is now guarded by `_authenticated`'s `beforeLoad` (this plan) — a valid session renders `AppShell` with no redirect.
- `AppShell` renders `NavRail` (role-gated) + `TopBar` (agency/language/user) + `Outlet`.
- `Outlet`'s only child this phase is a placeholder (`_authenticated.index.tsx`) — 01-07 is expected to add real placeholder routes for the other 4 base nav items + 3 admin sections and wire `NavRail`'s inert buttons to real `<Link>`s once those routes exist (currently `NavRail` intentionally does NOT link to them — see Known Stubs).
- One thing 01-07's E2E author should know: `NavRail`'s non-"today" items currently show a toast, not a navigation, on click — if 01-07's E2E plan intends to click through every base nav item, either 01-07 should replace those inert buttons with real `<Link>`s as part of adding the routes (natural, expected), or the E2E test should scope its "click every nav item" assertion to only the items with real routes until then.
- The owner-only agency-switcher's exact in-place-switch interaction (D5 above) and the user-menu/language-switcher chrome (D6) are flagged `human_judgment: true` in this SUMMARY's coverage block — not because anything is known-broken, but because no automated test exercises those specific interactions yet. 01-07's E2E pass is a natural place to add that coverage if the happy path it drives touches them.

---
*Phase: 01-foundations-auth-shell-i18n-design-system*
*Completed: 2026-07-23*

## Self-Check: PASSED

All 11 created/modified files verified present on disk; both task commits (442833b, b6d3878) verified present in git log.
