---
phase: 01-foundations-auth-shell-i18n-design-system
plan: 03
subsystem: auth
tags: [rbac, zustand, ky, jwt-refresh, single-flight, permissions]

requires:
  - phase: 01-01
    provides: identity-dto-types, msw-auth-handlers, role-scope-fixtures
provides:
  - permissions-ts-rbac-port
  - zustand-auth-store
  - single-flight-refresh-api-client
affects:
  - "01-04 (shell): AppShell/nav read scope from the store and gate via permissions.ts; route guard beforeLoad calls refreshAccessToken/scopeFromMe via this client"
  - "01-05 (screens): login/signup screens call api client and useAuthStore.setTokens"
  - "01-06 (i18n): unaffected directly but shares the same test harness conventions"

tech-stack:
  added: []
  patterns:
    - "src/shared/auth/permissions.ts is a literal, commented TypeScript port of wheelio-api's internal/domain/identity/scope.go — Scope is only ever constructed via scopeFromMe(me: MeResponse), never hand-built or JWT-decoded"
    - "src/shared/auth/store.ts: Zustand + persist with partialize returning ONLY { refreshToken } — accessToken/accessTokenExpiresAt/scope are memory-only and re-derived every boot; setCurrentAgency is a pure state write (no network)"
    - "src/shared/api/client.ts: module-level `let refreshPromise: Promise<string> | null` outside Zustand/React state, guarding concurrent 401s with a single shared /auth/refresh call — adapted to ky v2's `{request,response,retryCount}` hook object and `ky.retry()` forced-retry API (see Deviations)"

key-files:
  created:
    - src/shared/auth/permissions.ts
    - src/shared/auth/permissions.test.ts
    - src/shared/auth/store.ts
    - src/shared/auth/store.test.ts
    - src/shared/api/client.ts
    - src/shared/api/client.test.ts
  modified: []

decisions:
  - "ky installed is v2.0.2, a major version ahead of 01-RESEARCH.md's Pattern 1 sample (written against ky v1's `prefixUrl` option and positional-argument `(request, options, response)` hooks). Rewrote client.ts against the confirmed v2 API: `baseUrl` instead of `prefixUrl`, destructured `{request, response, retryCount}` hook state objects, and the built-in `ky.retry({request, code})` forced-retry mechanism (confirmed via ky's own source to bypass the default retry `methods` allow-list for forced retries, so POST/PUT requests get the single retry too, not just GET). The `retryCount === 0` guard replaces the research doc's implicit 'retry once' behavior — a retried request's own 401 (retryCount 1) falls through to a normal thrown HTTPError instead of looping."
  - "currentAgencyId is NOT persisted this phase, per the plan's own FLAGGED ASSUMPTION (01-RESEARCH.md Assumptions Log A1 / Open Questions #1) — it resets to null on a fresh page load; callers default to the org's first agency. Deferred to a follow-up plan if cross-reload continuity of the selected agency is desired."
  - "Dropped a planned source-text-scan test ('no jwt-decode import') because this project has no @types/node, so node:fs/node:path/process are unavailable to test files (tsc fails without adding a new dependency purely for a static-analysis assertion, out of scope for this plan's file list). The 'no JWT decoding' requirement is satisfied structurally instead — permissions.ts's only import is MeResponse, and every test exercises scopeFromMe as the sole Scope constructor — and documented inline in permissions.test.ts."

requirements-completed: [AUTH-01, AUTH-02, AUTH-03]

coverage:
  - id: D1
    description: "permissions.ts — literal TypeScript port of wheelio-api scope.go (isOrgAdmin, roleInAgency org-admin shortcut, canRead/canOperate/canManage rank gates, scopeFromMe as the sole Scope constructor)"
    requirement: "AUTH-03"
    verification:
      - kind: unit
        ref: "src/shared/auth/permissions.test.ts (10 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Zustand auth store — accessToken/scope memory-only, partialize persists ONLY refreshToken under localStorage key wheelio-auth, setCurrentAgency is a pure client state write with zero network calls, clearSession nulls the session"
    requirement: "AUTH-01"
    verification:
      - kind: unit
        ref: "src/shared/auth/store.test.ts (3 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "ky API client with single-flight refresh interceptor — concurrent 401s trigger exactly one POST /auth/refresh, successful refresh retries the original request once with no redirect, failed refresh clears the session and rejects without a retry loop"
    requirement: "AUTH-01, AUTH-02"
    verification:
      - kind: unit
        ref: "src/shared/api/client.test.ts (3 tests: concurrent-401 single-flight, refresh-success retry, refresh-failure clearSession)"
        status: pass
    human_judgment: false

duration: 21min
completed: 2026-07-23
status: complete
---

# Phase 01 Plan 03: Auth Core — permissions.ts, Zustand Store, Single-Flight Refresh Client Summary

Built the three pieces of auth infrastructure every later phase depends on: `permissions.ts` (a literal TypeScript port of wheelio-api's `scope.go` RBAC model), the Zustand `store.ts` (access token in memory, refresh token persisted, agency switch is a pure client state change), and `client.ts` (a ky-based API client with a race-free single-flight `/auth/refresh` interceptor) — adapted mid-implementation to the installed ky v2's breaking hook-API changes.

## Performance

- **Duration:** 21 min
- **Started:** 2026-07-23T09:27:00+02:00
- **Completed:** 2026-07-23T09:48:04+02:00
- **Tasks:** 3
- **Files modified:** 6 (all newly created)

## Accomplishments
- `permissions.ts`: literal port of `scope.go`'s `IsOrgAdmin`/`RoleInAgency`/`CanRead`/`CanOperate`/`CanManage`, with `scopeFromMe` as the single mapping point from a `/me` response into a `Scope` — nothing decodes the JWT for role data.
- `store.ts`: Zustand store with `persist`'s `partialize` writing ONLY `refreshToken` to `localStorage` (`wheelio-auth` key); `accessToken`/`accessTokenExpiresAt`/`scope` are memory-only; `setCurrentAgency` is a pure state write, proven to trigger zero `fetch` calls.
- `client.ts`: a ky API client whose `afterResponse` hook shares one module-level `refreshPromise` across concurrent 401s, proven by an MSW call-count test to issue exactly one `/auth/refresh` regardless of how many requests race; successful refresh retries the original request once via `ky.retry()`; failed refresh calls `clearSession()` and rethrows without looping.

## Task Commits

Each task followed the RED (failing test) -> GREEN (implementation) TDD cycle, each half committed atomically:

1. **Task 1: permissions.ts — TypeScript port of scope.go**
   - `e05b2f8` test(01-03): add failing test for permissions.ts RBAC port
   - `05e5e5a` feat(01-03): implement permissions.ts as literal port of scope.go
2. **Task 2: Zustand auth store with correct token persistence**
   - `b37cbaa` test(01-03): add failing test for Zustand auth store persistence
   - `145a5f1` feat(01-03): implement Zustand auth store with partial token persistence
3. **Task 3: ky API client with single-flight refresh interceptor**
   - `730f03e` test(01-03): add failing test for single-flight refresh API client
   - `f64fbae` feat(01-03): implement single-flight refresh ky API client

**Plan metadata:** committed separately (this SUMMARY + STATE.md/ROADMAP.md update)

## Files Created/Modified
- `src/shared/auth/permissions.ts` - RBAC types/functions ported from `scope.go`; `scopeFromMe` is the only Scope constructor
- `src/shared/auth/permissions.test.ts` - 10 tests covering rank gates, org-admin shortcut, and `/me` mapping
- `src/shared/auth/store.ts` - Zustand store: memory-only access token/scope, persisted refresh token, pure-state agency switch
- `src/shared/auth/store.test.ts` - 3 tests: partialize payload shape, `setCurrentAgency` zero-network, `clearSession`
- `src/shared/api/client.ts` - ky API client with single-flight refresh interceptor (ky v2 API)
- `src/shared/api/client.test.ts` - 3 tests: concurrent-401 single-flight, refresh-success retry, refresh-failure clearSession

## Decisions Made
- ky v2.0.2's breaking hook-API change (see Deviations) required rewriting client.ts against the confirmed current API rather than the research doc's v1-style sample; the single-flight `refreshPromise` architecture itself is unchanged from the plan's intent.
- `currentAgencyId` is not persisted this phase (flagged assumption from 01-RESEARCH.md, surfaced here rather than silently built past).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] ky v2's `prefixUrl` option was removed; hooks use a different signature**
- **Found during:** Task 3, running the plan's own mandated `npx vitest run src/shared/api/client.test.ts` verification for the first time.
- **Issue:** The installed `ky@2.0.2` throws `Error: The prefixUrl option has been renamed prefix in v2...` at client construction, and its `beforeRequest`/`afterResponse` hooks receive a single destructured state object (`{request, options, response, retryCount}`), not the positional `(request, options, response)` arguments 01-RESEARCH.md's Pattern 1 code sample used (written against ky v1). Using `request.headers.set(...)` on the old positional first-arg crashed with `Cannot read properties of undefined (reading 'set')` since `request` was actually the full options object under the new signature.
- **Fix:** Switched `prefixUrl` -> `baseUrl` (the option ky v2 actually resolves relative paths against, per ky's own README). Rewrote both `beforeRequest` and `afterResponse` hooks to destructure `{request}` / `{request, response, retryCount}`. Replaced the manual `return ky(request)` retry with ky v2's documented built-in mechanism for exactly this use case, `return ky.retry({request: new Request(request, {headers}), code: 'TOKEN_REFRESHED'})`, confirmed via ky's source (`Ky.js`) to bypass the default retry `methods` allow-list for forced retries so it also covers POST/PUT, not just GET. Added a `retryCount === 0` guard (ky's own README documents this exact "refresh on first 401 only" pattern) so the retried request's own 401 doesn't trigger a second refresh/retry loop.
- **Files modified:** `src/shared/api/client.ts`.
- **Verification:** All 3 tests in `client.test.ts` pass (concurrent-401 single-flight call-count, refresh-success retry-once, refresh-failure clearSession-and-reject); full suite (`npx vitest run --reporter=dot`) 6 files / 27 tests green; `npx tsc --noEmit` clean; `npm run build` succeeds.
- **Committed in:** `f64fbae` (Task 3 GREEN commit)

**2. [Scope adjustment] Dropped a planned static-analysis test for "no JWT decoding"**
- **Found during:** Task 1, writing `permissions.test.ts`.
- **Issue:** A source-text-scan test (reading `permissions.ts` via `node:fs` to assert no `jwt-decode`/`jsonwebtoken` import) failed `tsc --noEmit` with `TS2591: Cannot find name 'node:fs'` — this project has no `@types/node` installed (confirmed via `package.json`), and `import.meta.url`-based path resolution also isn't a `file://` URL inside Vitest's transformed modules.
- **Fix:** Removed the source-scan test; the "no JWT decoding" requirement is satisfied structurally — `permissions.ts`'s only import is `MeResponse`, and `scopeFromMe` is exercised as the sole Scope constructor across every other test in the file — and documented with an inline comment instead of a brittle test requiring a new dependency.
- **Files modified:** `src/shared/auth/permissions.test.ts`.
- **Committed in:** `05e5e5a` (Task 1 GREEN commit; the test was removed before the RED commit's failing-test baseline captured a working version, so no separate commit was needed)

---

**Total deviations:** 2 (1 Rule 3 blocking-issue fix, 1 scope adjustment to avoid a new dependency for a static-analysis-only test)
**Impact on plan:** The ky v2 API adaptation was necessary for the client to function at all against the installed dependency version; the underlying single-flight architecture and every acceptance criterion in the plan (exactly one refresh on concurrent 401s, retry-once on success, clearSession-and-reject on failure) are unchanged and independently proven by tests. No scope creep.

## Issues Encountered
None beyond the ky v2 API adaptation documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `permissions.ts`, `store.ts`, and `client.ts` are fully tested and ready for Plan 04 (shell) to wire the `_authenticated` route guard's `beforeLoad` (calling `refreshAccessToken`/`scopeFromMe`) and for Plan 05 (login/signup screens) to call `useAuthStore.getState().setTokens` after a successful `api.post('auth/login'|'auth/signup')`.
- No blockers. The ky v2 hook-API deviation is now the confirmed, tested pattern for any future ky client work in this repo — future plans should NOT reference 01-RESEARCH.md's Pattern 1 code sample literally; refer to `src/shared/api/client.ts` instead.

---
*Phase: 01-foundations-auth-shell-i18n-design-system*
*Completed: 2026-07-23*

## Self-Check: PASSED

All 7 created files verified present on disk; all 6 task commits (e05b2f8, 05e5e5a, b37cbaa, 145a5f1, 730f03e, f64fbae) verified present in git log.
