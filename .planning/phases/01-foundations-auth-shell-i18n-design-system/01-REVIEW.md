---
phase: 01-foundations-auth-shell-i18n-design-system
reviewed: 2026-07-23T00:00:00Z
depth: standard
files_reviewed: 41
files_reviewed_list:
  - src/shared/auth/permissions.ts
  - src/shared/auth/permissions.test.ts
  - src/shared/auth/store.ts
  - src/shared/auth/store.test.ts
  - src/shared/auth/session.ts
  - src/shared/auth/session.test.ts
  - src/shared/api/client.ts
  - src/shared/api/client.test.ts
  - src/features/auth/schemas.ts
  - src/features/auth/api.ts
  - src/features/auth/LoginForm.tsx
  - src/features/auth/SignupForm.tsx
  - src/features/auth/auth-forms.test.tsx
  - src/routes/__root.tsx
  - src/routes/login.tsx
  - src/routes/signup.tsx
  - src/routes/_authenticated.tsx
  - src/routes/_authenticated/index.tsx
  - src/routes/_authenticated/vehicules.tsx
  - src/routes/_authenticated/clients.tsx
  - src/routes/_authenticated/contrats.tsx
  - src/routes/_authenticated/etats-des-lieux.tsx
  - src/routes/_authenticated/admin/agences.tsx
  - src/routes/_authenticated/admin/facturation.tsx
  - src/routes/_authenticated/admin/identite-fiscale.tsx
  - src/routes/_authenticated/placeholders.test.tsx
  - src/app/router.tsx
  - src/app/providers.tsx
  - src/app/shell/AppShell.tsx
  - src/app/shell/NavRail.tsx
  - src/app/shell/TopBar.tsx
  - src/app/shell/AppShell.test.tsx
  - src/shared/i18n/index.ts
  - src/shared/i18n/useLocale.ts
  - src/shared/i18n/fr/common.json
  - src/shared/i18n/en/common.json
  - src/shared/ui/theme-provider.tsx
  - src/shared/ui/empty-state.tsx
  - src/test/mocks/handlers.ts
  - src/test/fixtures/scope.ts
  - e2e/auth.spec.ts
findings:
  critical: 2
  warning: 5
  info: 6
  total: 13
status: resolved
fixed: 2026-07-23
fix_commit: see "Fix Log" section
---

# Phase 01: Code Review Report

**Reviewed:** 2026-07-23
**Depth:** standard
**Files Reviewed:** 41 (plus contract-fidelity cross-check against wheelio-api `internal/domain/identity/scope.go` and `roles.go`, and API-surface verification against the installed `ky@2.0.2` type declarations)
**Status:** issues_found

## Summary

The security-sensitive fundamentals are in good shape: the access token never touches localStorage (verified in `store.ts` partialize + `store.test.ts` asserting the persisted payload is exactly `{ refreshToken }`), no token is ever logged (grep-clean for `console.*`), there is no `dangerouslySetInnerHTML`/`eval`/`innerHTML` write anywhere in `src/`, the RBAC rank gates match `scope.go`/`roles.go` exactly (including the org-admin implicit-manager shortcut), login/signup deliberately bypass the refresh interceptor with a documented rationale, and the FR-hard-default i18n config correctly restricts detection to a previously stored explicit choice.

However, the session-bootstrap memoisation in `src/shared/auth/session.ts` has a lifecycle defect with two critical manifestations: the module-level `sessionPromise` is cleared only on **rejection**, never on **resolution**. A promise that resolved to `null` (logged-out) or to a now-stale `Scope` (post-logout) is replayed forever within the SPA session. The practical consequence is that **logging in after being redirected to /login does not work without a manual page reload** — a mainline user flow. Neither the 64 vitest tests (which call `resetSession()` in every `beforeEach`) nor the 4 Playwright specs (which start with a hard `page.goto("/login")`, resetting module state) exercise the path that triggers it, which is why everything is green.

There are also robustness gaps in the refresh path (session nuked on transient network failure; a second unguarded entry point into `POST /auth/refresh` that can race the backend's rotation theft-detection) and a cross-user data-leak on logout (react-query cache + `agencies`/`currentAgencyId` survive `clearSession`).

## Fix Log (2026-07-23, post-review)

All 2 Critical + 5 Warning findings fixed in commit `fix(01): resolve code review findings CR-01/CR-02 + WR-01..WR-05`, with 7 regression tests (71 vitest total, 4/4 Playwright, tsc/build clean):

| Finding | Fix | Regression test |
|---------|-----|-----------------|
| CR-01 | `session.ts` memo now covers only the in-flight window (`.finally` clears it); durable success memo remains `store.scope` | `session.test.ts` "does NOT replay a resolved-null outcome after a subsequent login" |
| CR-02 | Same root fix + `handleLogout` calls `resetSession()` | `session.test.ts` "does NOT resurrect the pre-logout Scope after clearSession" |
| WR-01 | Single-flight guard moved inside `refreshAccessToken` (`doRefresh` split); interceptor now shares it | `client.test.ts` "refreshAccessToken itself is single-flight" |
| WR-02 | `clearSession` only on 401/403 (`isHTTPError` check); `MissingRefreshTokenError` distinguishes "never logged in"; bootstrap rethrows transient refresh failures (retry banner) instead of resolving null (false "Session expirée") | `client.test.ts` + `session.test.ts` 503-preserves-token tests |
| WR-03 | `clearSession` resets `agencies`/`currentAgencyId`; logout purges react-query cache via `useQueryClient().clear()` | `store.test.ts` "clearSession also drops agency data" |
| WR-04 | `Object.hasOwn` guard in `roleInAgency` | `permissions.test.ts` prototype-chain keys test |
| WR-05 | AppShell `null` resolution redirects to `/login?reason=session-expired` instead of dead-end banner | covered by CR-01/CR-02 semantics; banner reserved for rejections |

Info findings (IN-01..IN-06) deliberately not fixed this pass — none is a defect in a shipped phase-1 behavior (IN-03's direct-URL admin placeholders expose no data and the backend re-enforces authorization; the rest are polish/hardening candidates for phase 2+).

## Critical Issues

### CR-01: Stale resolved-`null` session memo makes login impossible after a guard redirect (SPA-wide login loop)

**File:** `src/shared/auth/session.ts:36-63`
**Issue:** `ensureSession()` memoises `bootstrap()` in the module-level `sessionPromise`, but only clears the memo on **rejection** (the `.catch` at line 54-60). When `bootstrap()` **resolves to `null`** (no refresh token / refresh rejected — session.ts:68-74), the resolved-null promise stays memoised for the lifetime of the tab. Reproduction, using only mainline flows:

1. Logged-out user opens `/` (or any deep link) → `_authenticated.beforeLoad` → `ensureSession()` → `bootstrap()` resolves `null` → redirect to `/login`. `sessionPromise` is now a **resolved-null promise that is never cleared**.
2. User submits valid credentials → `LoginForm.onSubmit` calls `setTokens(...)` (tokens are correctly stored) → `navigate({ to: "/" })`.
3. Guard runs again → `ensureSession()`: `scope` is still `null` (login only sets tokens, not scope) → `sessionPromise` is non-null → returns the **stale `null`** → `throw redirect({ to: "/login", search: { reason: "session-expired" } })`.

The user is bounced straight back to `/login` with a misleading "Session expirée" toast, despite holding valid freshly-issued tokens. Every subsequent attempt loops identically; only a full page reload (resetting module state) escapes. Nothing in the codebase calls `resetSession()` on login (`LoginForm.tsx`, `SignupForm.tsx`, `login.tsx`, `router.tsx` — none import it).

This is untested precisely along the failing seam: `session.test.ts` calls `resetSession()` in `beforeEach`/`afterEach` (lines 21, 25-26), and `e2e/auth.spec.ts:97` starts every scenario with `page.goto("/login")` — a fresh page load — so the "redirect-to-login, then log in" sequence is never executed in-SPA.

**Fix:** Clear the memo whenever bootstrap resolves without a usable scope, so a later call re-attempts:
```ts
if (!sessionPromise) {
  sessionPromise = bootstrap().then(
    (scope) => {
      if (scope === null) sessionPromise = null; // don't memoise "logged out"
      return scope;
    },
    (err: unknown) => {
      sessionPromise = null;
      throw err;
    },
  );
}
```
(The successful-scope memo is unaffected: the fast path is the store's `scope`, checked first at line 50-51.) Additionally add a regression test for: guard-null → `setTokens` → `ensureSession()` resolves a real Scope; and an E2E that visits `/` logged-out, gets redirected, then logs in.

### CR-02: Logout leaves a stale resolved-`Scope` memo — auth guard passes with a dead session

**File:** `src/shared/auth/session.ts:36-63`, `src/app/shell/TopBar.tsx:134-141`
**Issue:** Mirror image of CR-01. After a successful bootstrap, `sessionPromise` holds a resolved `Scope`. `TopBar.handleLogout` calls `clearSession()` (store wiped) and navigates to `/login`, but never calls `resetSession()`. If the user then navigates back to any authenticated route (browser Back button, deep link, typing `/`):

1. `ensureSession()` → store `scope` is `null` (cleared) → falls through to the memoised `sessionPromise` → returns the **pre-logout Scope**.
2. `_authenticated.beforeLoad` sees a non-null scope → **guard passes with no valid session** — no redirect to `/login`.
3. `AppShell` mounts, store `scope` is null → mount effect calls `load()` → `ensureSession()` again returns the stale Scope → `setStatus("ready")`, but the render gate `if (status === "error" || !scope)` (AppShell.tsx:85) reads the null **store** scope → the logged-out user is shown the "Impossible de charger votre profil" error banner with a Retry button instead of the login screen.

No protected data is exposed (any real API call would 401 → refresh → fail → clear), but the route guard is demonstrably bypassable with a revoked session, and the resulting UX is a dead end (see WR-05).

**Fix:** Same memo fix as CR-01 covers the guard re-evaluation only if the stale promise is also invalidated on logout. Do both: (a) call `resetSession()` inside `handleLogout`'s `finally` (TopBar.tsx:137-140), and (b) more robustly, subscribe `clearSession` to also reset the memo — e.g. export a `logoutCleanup()` in `session.ts` that calls `clearSession()` + `resetSession()` and make it the single logout path, so no future caller can clear the store without clearing the memo.

## Warnings

### WR-01: `POST /auth/refresh` has a second, unguarded entry point — single-flight is not actually single-flight

**File:** `src/shared/api/client.ts:42-78,102-104`, `src/shared/auth/session.ts:70`
**Issue:** The module header sells a guarantee — "only ONE `POST /auth/refresh` is ever in flight at a time" — because wheelio-api rotates refresh tokens and treats stale-token reuse as theft, revoking the whole session. But the `refreshPromise` guard lives only in the `afterResponse` hook (client.ts:102). `session.ts:70` calls the exported `refreshAccessToken()` **directly**, bypassing the guard. If a bootstrap-triggered refresh and an interceptor-triggered refresh (from any request that 401s while bootstrap is in flight — a React Query prefetch, a fetch started outside the route guard, any future feature code) overlap, two concurrent `POST /auth/refresh` calls go out with the same token; the loser hits the backend's reuse detection and the entire session is revoked → surprise logout. Today the route-guard sequencing makes the window narrow, but nothing structural prevents it, and the failure mode (rare, timing-dependent forced logout) is the worst kind to debug later.
**Fix:** Move the single-flight guard inside `refreshAccessToken` itself so every caller shares it:
```ts
export function refreshAccessToken(): Promise<string> {
  refreshPromise ??= doRefresh().finally(() => { refreshPromise = null; });
  return refreshPromise;
}
```
and have the `afterResponse` hook simply `await refreshAccessToken()`.

### WR-02: A transient network failure during refresh permanently destroys the persisted session

**File:** `src/shared/api/client.ts:74-77`
**Issue:** `refreshAccessToken`'s `catch` block calls `clearSession()` on **any** error — including a network drop, a timeout, or a 5xx from the API — which nulls `refreshToken` and (via persist) wipes it from localStorage. A user on flaky mobile connectivity who happens to hit the refresh path while offline is logged out irrecoverably, even though their refresh token is still perfectly valid server-side. Only an explicit auth rejection (401/403) proves the token is dead.
**Fix:** Discriminate before clearing:
```ts
} catch (err) {
  if (isHTTPError(err) && (err.response.status === 401 || err.response.status === 403)) {
    clearSession();
  }
  throw err;
}
```
Transient failures then reject without destroying the session; the guard resolves `null` for that navigation but the next attempt can still succeed. Add a test: refresh endpoint returns a network error → `refreshToken` must survive in the store.

### WR-03: Logout does not clear the react-query cache or `agencies`/`currentAgencyId` — cross-user data leak in the same tab

**File:** `src/shared/auth/store.ts:85-92`, `src/app/providers.tsx:8`, `src/app/shell/TopBar.tsx:41-55,134-141`
**Issue:** `clearSession()` resets tokens/scope/user but deliberately-or-not leaves `agencies: [...]` and `currentAgencyId` populated, and nothing anywhere calls `queryClient.clear()` (the `QueryClient` in providers.tsx:8 is module-scoped and lives for the tab). Sequence: org-admin of org A logs out at a shared workstation; org-admin of org B logs in on the same tab. `AgencySwitcher`'s `useQuery({ queryKey: ["agencies"] })` immediately serves **org A's cached agency list** (names, addresses, phones) while refetching, and the store's stale `currentAgencyId` (an org-A agency UUID) short-circuits the auto-select effect (`if (!currentAgencyId ...)` — TopBar.tsx:52), leaving user B's "current agency" pointing at an agency of a different organization until they manually switch. This violates the multi-tenant cloisonnement principle client-side.
**Fix:** In `clearSession`, also reset `agencies: []` and `currentAgencyId: null`; in the logout path, call `queryClient.clear()` (expose it or handle logout via a function that has access to the client).

### WR-04: `roleInAgency` resolves prototype members — `canRead(scope, "constructor")` returns `true`

**File:** `src/shared/auth/permissions.ts:47-55,78-80`
**Issue:** `agencyRoles` is built with `Object.fromEntries` (plain object, full `Object.prototype` chain) and looked up with `scope.agencyRoles[agencyId]`. For a non-admin member, `roleInAgency(scope, "constructor")` returns the `Object` constructor function (not `undefined`), so `canRead(scope, "constructor")` — and `"toString"`, `"valueOf"`, etc. — returns `true`. A Go map has no such phantom keys, so this is a semantic deviation from the `scope.go` contract the file claims to port literally. Exploitability is low today (agency IDs come from `/me`), but `agencyId` will plausibly flow from URL path params in later phases (`/agences/$agencyId`), at which point a crafted URL makes read-gated UI render for a user with zero memberships. `canOperate`/`canManage` are incidentally safe only because `RANK[fn]` is `undefined` — an accident, not a design.
**Fix:** Either build the map with a null prototype (`Object.assign(Object.create(null), ...)` / use a `Map`), or guard the lookup:
```ts
return Object.hasOwn(scope.agencyRoles, agencyId) ? scope.agencyRoles[agencyId] : undefined;
```
Add a test: `canRead(scope, "constructor") === false` for a membership-less member.

### WR-05: AppShell renders a dead-end Retry banner when the session is genuinely gone (null result treated as `/me` error)

**File:** `src/app/shell/AppShell.tsx:58-63,79-85`, `src/routes/_authenticated.tsx:26-37`
**Issue:** `load()` maps a `null` resolution — the documented "no session can be established, redirect to login" outcome — to `setStatus("error")`, i.e. the "Impossible de charger votre profil" banner, whose Retry button can never succeed (`resetSession()` → bootstrap → no refresh token → `null` → banner again, forever). Reachable path without CR-02: user is inside the shell, access token expires, next API-less navigation is fine but a fresh `/me` bootstrap is triggered (e.g. Retry after a 500, or the mount-time `load()` after the guard swallowed a `/me` 401 whose interceptor-refresh failed and cleared the session — `_authenticated.tsx:32-36` deliberately swallows that rejection). The user is stuck on a retry loop for a state that means "you are logged out"; the shell never redirects by design, and nothing else does either.
**Fix:** In `load()`, treat `null` as session-gone and navigate to `/login?reason=session-expired` (AppShell is mounted post-first-navigation, so `useNavigate`/toast are both safe here), reserving the error banner for rejections only:
```ts
ensureSession()
  .then((result) => {
    if (result) setStatus("ready");
    else void navigate({ to: "/login", search: { reason: "session-expired" } });
  })
  .catch(() => setStatus("error"));
```

## Info

### IN-01: UserMenu role label shows an arbitrary membership's role, not the current agency's

**File:** `src/app/shell/TopBar.tsx:130-132`
**Issue:** For non-org-admins, the badge uses `Object.values(scope.agencyRoles)[0]` — insertion-order-first membership, unrelated to `currentAgencyId`. A user who is manager in agency A and viewer in agency B always sees whichever `/me` listed first.
**Fix:** Resolve via `roleInAgency(scope, currentAgencyId)` when a current agency is set, falling back to the highest-ranked membership otherwise.

### IN-02: `HasOrgRole` from scope.go is not ported

**File:** `src/shared/auth/permissions.ts` (whole module) vs wheelio-api `internal/domain/identity/scope.go:51-61`
**Issue:** The backend's `HasOrgRole(min)` — used for org-level shared resources without an agencyID (clients, per its own D-10 comment) — has no client mirror, and the module doc doesn't note the omission. The "Clients" nav destination ships this phase; the first client screen will need this gate and someone may hand-roll it divergently.
**Fix:** Port `hasOrgRole(scope, min)` now (trivial), or add an explicit "not yet ported: HasOrgRole" note to the header inventory.

### IN-03: Admin placeholder routes reachable by direct URL for non-admin users

**File:** `src/routes/_authenticated/admin/agences.tsx`, `facturation.tsx`, `identite-fiscale.tsx`
**Issue:** D-09 gating is nav-only; a member navigating to `/admin/agences` by URL renders the placeholder. Harmless while these are `EmptyState`, and the file comments acknowledge it, but there is no structural reminder that a `beforeLoad` `isOrgAdmin` gate must land together with the first real admin screen.
**Fix:** Add an `isOrgAdmin` `beforeLoad` gate on an `/admin` layout route now (cheap, one file), or track it explicitly in the phase-2+ plan.

### IN-04: "Owner-only" agency switcher is actually org-admin (owner OR admin)

**File:** `src/app/shell/TopBar.tsx:3,44,57`, `src/shared/auth/store.ts:51`
**Issue:** Comments and the store field doc say "owner-only" (D-10/D-11), but the code gates on `isOrgAdmin(scope)`, which includes `admin`. Either the docs are wrong or the behavior is; the E2E only tests owner vs agent, so an `admin`-role user's expected experience is unpinned.
**Fix:** Align the comments with `isOrgAdmin` (likely correct, matching the backend's owner/admin equivalence) or tighten the gate to `orgRole === "owner"` if D-10 literally means owner.

### IN-05: No test covers the refresh-then-retry path for a request with a body (POST/PUT)

**File:** `src/shared/api/client.test.ts:36-123`, `src/shared/api/client.ts:108-114`
**Issue:** All three interceptor tests use `GET /protected`. The forced-retry path constructs `new Request(request, { headers })`; ky's own `ForceRetryOptions.request` docs warn about consumed request bodies. ky keeps the hook's request unconsumed internally, so this should work — but the claim in the module header ("works for POST/PUT requests too") is verified only by reading ky's source, not by a test, and a ky upgrade could silently regress it.
**Fix:** Add one test: `POST /protected` with a JSON body 401s, refresh succeeds, retried request carries both the new token **and** the original body.

### IN-06: ThemeProvider trusts localStorage blindly (`as Theme` cast)

**File:** `src/shared/ui/theme-provider.tsx:31`
**Issue:** `localStorage.getItem(storageKey) as Theme` — any corrupted/foreign value (e.g. another app's leftovers on localhost) becomes `theme`, and `root.classList.add("<garbage>")` leaves the app stuck in neither light nor dark. Verbatim shadcn pattern, so consciously accepted, but a one-line validation is free.
**Fix:** `const stored = localStorage.getItem(storageKey); return stored === "dark" || stored === "light" || stored === "system" ? stored : defaultTheme;`

---

## Verified Non-Issues (priority concerns checked and cleared)

- **Token handling:** access token is memory-only; `partialize` persists exactly `{ refreshToken }` and `store.test.ts:39-47` asserts the negative. No token appears in any log statement (zero `console.*` in `src/`).
- **RBAC fidelity:** rank table `viewer:1 < agent:2 < manager:3` and the owner/admin implicit-manager shortcut match `roles.go`/`scope.go` exactly (modulo WR-04's prototype edge and IN-02's omission).
- **Interceptor loop bound:** `retryCount > 0` guard + verified against installed `ky@2.0.2` — `retryCount` is `0` on the initial request, `>= 1` on the forced retry, and `ForceRetryOptions` genuinely supports `{ request, code }` (the code mirrors ky's own documented `TOKEN_REFRESHED` example).
- **Login/signup 401s:** correctly bypass the shared client (bare `ky.post`), so credential failures never trigger a bogus refresh; `logout` correctly uses the shared client.
- **i18n:** FR hard default enforced by restricting detection `order` to `localStorage` only; no `navigator.language` path; all user-facing strings in both forms, shell, nav, placeholders go through `t()`; FR/EN key sets are in parity; `escapeValue: false` is safe given no `dangerouslySetInnerHTML` anywhere.
- **XSS surfaces:** none found — no `dangerouslySetInnerHTML`, no `eval`, no `innerHTML` writes (`main.tsx:8` is a read-only guard).

---

_Reviewed: 2026-07-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
