---
phase: 01-foundations-auth-shell-i18n-design-system
verified: 2026-07-23T15:20:00Z
status: human_needed
score: 6/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Open /signup and enter a very long organization name (e.g. 'Société Algérienne de Location de Véhicules Touristiques et Utilitaires de l'Ouest SARL'); observe the auth card."
    expected: "The name wraps gracefully inside the card; no horizontal overflow or layout break of the auth card."
    why_human: "Declared `verification: backstop` in 01-05-PLAN must_haves — visual layout behavior under long content cannot be proven by grep/tests; no test exercises it."
  - test: "In the authenticated shell at standard desktop width, compare nav labels in FR ('États des lieux') and after switching to EN ('Inspections')."
    expected: "Neither locale's labels wrap onto two lines or truncate in the desktop nav rail."
    why_human: "Declared `verification: backstop` in 01-06-PLAN must_haves — label-width fit at a given viewport is a visual property; the `truncate` class exists as a safety but whether it triggers at standard width is only observable by eye."
---

# Phase 1: Foundations — Auth, Shell, i18n, Design System — Verification Report

**Phase Goal:** A user can log in, see navigation and actions that match their role, work across agencies and sessions without interruption, and experience one consistently designed, bilingual interface from the very first screen.
**Verified:** 2026-07-23
**Status:** human_needed (all programmatic checks pass; 2 planner-declared backstop visual checks remain)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria + AUTH-06)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | User can log in with email/password and remains logged in across browser sessions, with token refresh happening invisibly (SC1 / AUTH-01) | ✓ VERIFIED | `store.ts` persists ONLY `refreshToken` via `partialize` (asserted negatively in `store.test.ts`); `session.ts` bootstrap = refresh → `/me` → `scopeFromMe`; behavioral: Playwright "owner: logs in…" passes; `client.test.ts` "refresh success retries the original request once and returns its result — no redirect, no clearSession" passes |
| 2 | An expiring session never hard-redirects a user out of in-progress work — refresh completes silently (SC2 / AUTH-02) | ✓ VERIFIED | Single-flight refresh interceptor in `client.ts` (guard now inside `refreshAccessToken` itself — WR-01 fix); `_authenticated.tsx` redirects ONLY on resolved-`null` (refresh-token failure), swallows `/me` rejections for AppShell retry; behavioral: `client.test.ts` "two concurrent 401s trigger exactly ONE POST /auth/refresh", "transient refresh failure rejects WITHOUT clearing the session (WR-02)"; `session.test.ts` CR-01/CR-02 regression tests all pass |
| 3 | Navigation and actions match the user's role exactly as returned by `/me` scope — no re-derived role logic (SC3 / AUTH-03) | ✓ VERIFIED | `permissions.ts` is a literal port of `scope.go` (rank viewer<agent<manager, owner/admin implicit-manager, `Object.hasOwn` guard — WR-04 fix); `Scope` built only via `scopeFromMe(me)`; `NavRail`/`TopBar` gate solely on `isOrgAdmin(scope)`; behavioral: Playwright owner (full nav + admin) vs agent (identical base nav, admin fully absent) both pass |
| 4 | Owner can switch between agencies and the shell reflects the new agency context everywhere (SC4 / AUTH-04) | ✓ VERIFIED | `AgencySwitcher` in `TopBar.tsx` (org-admin-only, lists `GET /agencies`, accent-marked selection, pure client-state `setCurrentAgency`); behavioral: Playwright "agency switch is in-place — no navigation reset, zero /me or /auth/refresh calls" passes with live request counters |
| 5 | Interface switchable FR (default) / EN at any time, every screen reflects it immediately (SC5 / AUTH-05) | ✓ VERIFIED | `i18n/index.ts` hard-FR default (`fallbackLng: "fr"`, detection restricted to `localStorage` only); FR/EN key parity 44/44 (scripted check, zero missing either direction); `useLocale` persists explicit choice; behavioral: Playwright "FR default everywhere, EN copy live after switch" passes (placeholder + nav + chrome all live-switch) |
| 6 | App is built on a documented design-token system + base component library applied consistently (AUTH-06) | ✓ VERIFIED | `src/index.css`: 136 CSS custom properties, `:root` (light) + `.dark` (dark) both shipped, spacing scale + Inter variable font + `@theme inline` Tailwind-v4 mapping; 16 shadcn components vendored in `src/shared/ui/`; `theme-provider.tsx` toggles `.dark` with `wheelio-ui-theme` persistence (tested); components consume token classes (`bg-primary`, `text-foreground`) — one source of truth |
| 7 | Long organization names in the signup form wrap gracefully, no horizontal overflow (01-05 backstop) | ? HUMAN | `verification: backstop` — abstain per honest-verifier rule; no explicit evidence; routed to human verification |
| 8 | FR vs EN nav labels neither wrap nor truncate at standard desktop nav width (01-06 backstop) | ? HUMAN | `verification: backstop` — abstain; `truncate` class present as safety net but visual fit unproven; routed to human verification |

**Score:** 6/8 truths verified (0 present-behavior-unverified; 2 backstop → human)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/types/identity.ts` | 1:1 DTO mirror of wheelio-api | ✓ VERIFIED | Cross-checked read-only against `wheelio-api/internal/adapter/httpapi/dto.go` (`org_role` json tag confirmed); `AuthResponse` carries `access_token`/`access_token_expires_at`/`refresh_token` |
| `src/test/mocks/handlers.ts` + `server.ts` + `setup.ts` | MSW wired for all tests | ✓ VERIFIED | 13 vitest files / 71 tests run against MSW; `setup.ts` bootstraps server |
| `src/index.css` | Token system, light+dark | ✓ VERIFIED | `:root` + `.dark` blocks, spacing/typography/`--color-*` mapping |
| `src/shared/ui/*` (component library) | 13 base shadcn components | ✓ VERIFIED (documented deviation) | 16 files present; `form.tsx` → `field.tsx` substitution: official registry retired `form` (empty stub) in favor of `field` — documented in 01-02-SUMMARY deviations with `npx shadcn view` evidence; same registry, same capability; `LoginForm` imports `Field`/`FieldError` and works E2E |
| `src/shared/auth/permissions.ts` | Literal scope.go port | ✓ VERIFIED | Rank table + admin shortcut + `Object.hasOwn` prototype guard; tests incl. "never resolves prototype-chain keys (WR-04)" |
| `src/shared/auth/store.ts` | Refresh-token-only persistence | ✓ VERIFIED | `partialize` exact; `clearSession` also drops `agencies`/`currentAgencyId` (WR-03 fix, tested) |
| `src/shared/api/client.ts` | Single-flight refresh client | ✓ VERIFIED | Guard inside `refreshAccessToken`; 401/403-only session clear; `MissingRefreshTokenError`; bounded one retry |
| `src/shared/auth/session.ts` | Session bootstrap | ✓ VERIFIED | In-flight-only memo (`.finally` clears — CR-01/CR-02 fix); null vs reject failure modes distinguished |
| `src/shared/i18n/*` | FR/EN runtime + copy | ✓ VERIFIED | 44/44 key parity; CLDR `_one`/`_other` plurals; no `compatibilityJSON`, no `i18next-icu` |
| `src/features/auth/*` + `src/routes/login.tsx`, `signup.tsx` | Login/signup screens | ✓ VERIFIED | Bare-ky login/signup (bypass interceptor, documented); `login.tsx` shows "Session expirée" toast on `reason=session-expired` |
| `src/app/shell/*` + `src/routes/_authenticated.tsx` | Role-aware shell + guard | ✓ VERIFIED | Guard redirects only on null; AppShell null-resolution redirects to `/login?reason=session-expired` (WR-05 fix); skeleton → error+Retry states |
| `src/shared/ui/empty-state.tsx` + placeholder routes | All nav destinations resolve | ✓ VERIFIED | 5 base + 3 admin placeholder routes exist under `_authenticated`; E2E navigates them |
| `e2e/auth.spec.ts` | E2E happy path | ✓ VERIFIED | 4/4 Playwright tests pass against built app (vite preview) |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| `client.ts` beforeRequest | auth store | reads `accessToken`, sets Authorization header | ✓ WIRED |
| `client.ts` afterResponse 401 | `refreshAccessToken` → `setTokens` | shared single-flight promise (WR-01: interceptor + bootstrap share it) | ✓ WIRED |
| `_authenticated.tsx` beforeLoad | `session.ts` `ensureSession` | router `context.auth` | ✓ WIRED |
| `session.ts` bootstrap | `scopeFromMe` → store | `/me` → `setScope`/`setUser` | ✓ WIRED |
| `NavRail`/`TopBar` visibility | `permissions.ts` | `isOrgAdmin(scope)` only — no re-derived logic | ✓ WIRED |
| `AgencySwitcher` | `GET /agencies` → store → render | useQuery → `setAgencies` → dropdown; selection = pure `setCurrentAgency` | ✓ WIRED |
| `login/signup` forms | store | success → `setTokens` → navigate into shell (E2E-proven) | ✓ WIRED |
| `useLocale` | i18next + localStorage | `changeLanguage` + detector cache under `wheelio-locale` | ✓ WIRED |
| shadcn components | `index.css` tokens | token utility classes → CSS variables, `.dark` flips all | ✓ WIRED |
| `handleLogout` | `clearSession` + `resetSession` + `queryClient.clear()` | single logout path (CR-02/WR-03 fix) | ✓ WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Type-safety | `npx tsc --noEmit` | exit 0, no errors | ✓ PASS |
| Production build | `npm run build` | built in 261ms, bundle emitted | ✓ PASS |
| Unit/integration suite | `npx vitest run` (run once) | 13 files, 71/71 passed | ✓ PASS |
| E2E happy path | `npx playwright test` | 4/4 passed (owner nav, agent nav, agency switch w/ zero session traffic, FR→EN live switch) | ✓ PASS |
| Review regression tests | enumerated from verbose vitest output | All 7 present + passing: CR-01, CR-02, WR-01, WR-02 (client+session), WR-03, WR-04 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
| ----------- | ------------ | ------ | -------- |
| AUTH-01 | 01-01, 01-03, 01-05 | ✓ SATISFIED | Truth 1 |
| AUTH-02 | 01-03, 01-05, 01-06 | ✓ SATISFIED | Truth 2 |
| AUTH-03 | 01-01, 01-03, 01-06, 01-07 | ✓ SATISFIED | Truth 3 |
| AUTH-04 | 01-06 | ✓ SATISFIED | Truth 4 |
| AUTH-05 | 01-04, 01-07 | ✓ SATISFIED | Truth 5 (backstop label-width check → human) |
| AUTH-06 | 01-02 | ✓ SATISFIED | Truth 6 (form→field documented deviation) |

No orphaned requirements: REQUIREMENTS.md maps exactly AUTH-01..06 to Phase 1; all six are claimed by plans.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
| ---- | ------- | -------- | ------ |
| — | No TBD/FIXME/XXX/TODO/HACK markers in `src/` or `e2e/` | — | Debt-marker gate clean |
| — | No `dangerouslySetInnerHTML`/`eval` in `src/` | — | XSS surface clean |
| — | No `i18next-icu`/`next-themes` in package.json | — | Plan prohibitions honored |
| — | No forgot-password affordance (negative-asserted in `auth-forms.test.tsx`) | — | D-05/D-06 honored |

Note: "Bientôt disponible" placeholder pages are the *deliverable* of plan 01-07 (deliberate empty-state routes for future phases), not stub anti-patterns.

Info findings IN-01..IN-06 from 01-REVIEW.md remain open by explicit decision (documented in the review's Fix Log rationale) — none blocks a phase-1 success criterion. IN-03 (admin placeholders reachable by direct URL) should be tracked for the first real admin screen.

### Human Verification Required

#### 1. Signup card — long organization name

**Test:** Open `/signup`, type a very long organization name.
**Expected:** Name wraps inside the auth card; no horizontal overflow.
**Why human:** Planner-declared backstop truth (01-05); visual layout not exercisable by grep or existing tests.

#### 2. Desktop nav — FR vs EN label widths

**Test:** In the shell at standard desktop width, view nav in FR, then switch to EN.
**Expected:** No nav item wraps or truncates in either locale.
**Why human:** Planner-declared backstop truth (01-06); label fit is visual-only (a `truncate` safety class exists, so a silent truncation would not fail any test).

### Gaps Summary

No gaps. All 5 roadmap success criteria plus AUTH-06 are verified in the codebase with behavioral evidence (71/71 vitest incl. 7 review-fix regression tests, 4/4 Playwright, tsc + build clean, all commands re-run by the verifier — not taken from SUMMARY claims). The 2 Critical and 5 Warning code-review findings were confirmed fixed **in the actual source**, not just claimed. The only outstanding items are the two planner-declared backstop visual checks above, which route to human verification by design.

---

_Verified: 2026-07-23_
_Verifier: Claude (gsd-verifier)_
