---
phase: 01-foundations-auth-shell-i18n-design-system
plan: 05
subsystem: auth
tags: [react-hook-form, zod, tanstack-router, i18next, shadcn, login, signup]

requires:
  - phase: 01-02
    provides: design-token-system, shadcn-base-components (Button/Input/Field/Card), auth-gradient-bg
  - phase: 01-03
    provides: zustand-auth-store (setTokens), shared-ky-client
  - phase: 01-04
    provides: i18next-fr-default-runtime, phase1-copy-inventory
provides:
  - login-signup-screens
  - auth-feature-api-login-signup-logout
affects:
  - "01-06 (shell): route guard's beforeLoad redirects unauthenticated users to /login; AppShell mounts once a session exists from here"
  - "01-07 (placeholder routes + e2e): the login->app happy path this plan enables is the entry point of the e2e test"

tech-stack:
  added: []
  patterns:
    - "src/features/auth/api.ts: login()/signup() use a BARE ky request (not the shared `api` client with its refresh-on-401 interceptor) — both endpoints are unauthenticated and can legitimately return 401 on a genuine credentials failure; routing them through the interceptor would misinterpret that as an expired access token and attempt an unrelated /auth/refresh. logout() DOES use the shared `api` client since it is an authenticated call. See Deviations."
    - "Card auth-screen padding override via Tailwind arbitrary property: className=\"[--card-spacing:1.5rem]\" on the shadcn Card component, implementing the Spacing Scale's lg (24px) auth-screen exception without a new Card size variant."
    - "D-06 generic-error handling: LoginForm's onSubmit catch block never inspects the caught error — ANY failure (401, network error, etc.) renders the same t(\"auth.loginError\") string, structurally guaranteeing unknown-email/wrong-password are indistinguishable."
    - "SignupForm distinguishes exactly one error shape via ky's isHTTPError(err) && err.response.status === 409 -> field-level auth.signupEmailInUse via react-hook-form's setError('email', ...); every other failure (network, 5xx, etc.) falls through to a generic auth.genericError banner."

key-files:
  created:
    - src/features/auth/schemas.ts
    - src/features/auth/schemas.test.ts
    - src/features/auth/api.ts
    - src/features/auth/LoginForm.tsx
    - src/features/auth/SignupForm.tsx
    - src/features/auth/auth-forms.test.tsx
    - src/routes/login.tsx
    - src/routes/signup.tsx
  modified:
    - src/shared/i18n/fr/common.json
    - src/shared/i18n/en/common.json

decisions:
  - "[Rule 1 - Bug] login()/signup() bypass the shared `api` ky client's single-flight-refresh afterResponse hook, calling a bare `ky.post(..., { baseUrl })` instead — identical reasoning to why client.ts's own refreshAccessToken() already avoids `api`. Routing an unauthenticated /auth/login or /auth/signup call through the interceptor would misfire on a genuine 401 (wrong password): the hook would try to refresh using whatever refreshToken might be left in the store from an unrelated previous session, then either surface a confusing 'no refresh token' Error instead of the real credentials failure, or silently rotate/clear an unrelated session's tokens as a side effect of a failed new login attempt."
  - "[Rule 2 - Missing critical functionality] Added field-label/placeholder/cross-link/generic-error i18n keys (auth.emailLabel, auth.passwordLabel, auth.organizationNameLabel, auth.firstNameLabel, auth.lastNameLabel, auth.emailPlaceholder, auth.loginTitle, auth.signupTitle, auth.noAccountPrompt/goToSignup, auth.hasAccountPrompt/goToLogin, auth.genericError) to fr/en common.json. Plan 04's copy inventory only covered CTA text + the generic login error + email-in-use + session-expiry — it had no strings for the actual form field labels, headings, or login<->signup cross-links this plan's own task explicitly requires ('Copy comes exclusively from i18n keys' + 'Do not ship bare JSX string literals'). Without these keys the forms would either be inaccessible (unlabeled inputs) or violate that prohibition outright."
  - "auth.organizationNameLabel is worded 'Nom de l'organisation'/'Organization name', not 'agence'/'agency' — signup creates a new Organization (tenant), not an agency, and the DTO field is organization_name; using 'agence' here would conflate the two domain concepts AUTH-04's agency switcher later depends on keeping distinct."
  - "Zod's own default validation messages (e.g. 'Invalid email', 'Too small: expected string to have >=8 characters') are left untranslated/in English. 01-UI-SPEC.md's Copywriting Contract enumerates exactly 4 auth strings (login CTA, signup CTA, login/signup failure, session-expiry) and field-level validation microcopy is not among them — scoped out rather than invented, mirroring 01-04's own pattern of flagging copy gaps instead of silently expanding the contract."
  - "auth-forms.test.tsx builds a minimal 3-route (/, /login, /signup) TanStack Router memory-history tree per test rather than importing the app's real routeTree.gen.ts, so LoginForm/SignupForm's useNavigate()/Link resolve real navigations without depending on 01-06's not-yet-built _authenticated layout route."

requirements-completed: [AUTH-01, AUTH-02]

coverage:
  - id: D1
    description: "loginSchema/signupSchema — Zod validation mirroring wheelio-api's loginRequest/signupRequest DTOs exactly (email format, password min(8), required organization_name/first_name/last_name)"
    requirement: "AUTH-01"
    verification:
      - kind: unit
        ref: "src/features/auth/schemas.test.ts (8 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "auth/api.ts — login()/signup() (bare ky, bypassing the refresh interceptor) and logout() (via the shared client), all typed against AuthResponse"
    requirement: "AUTH-01"
    verification:
      - kind: unit
        ref: "src/features/auth/auth-forms.test.tsx (login/signup success + failure paths exercise api.ts indirectly via MSW)"
        status: pass
    human_judgment: false
  - id: D3
    description: "LoginForm — successful submit stores tokens via setTokens and navigates into the app; submit button disables + shows an inline spinner while pending; any failure (401 or otherwise) renders the same generic i18n error with no password-reset/forgot-password affordance anywhere (D-05/D-06); inline Zod field errors before submit"
    requirement: "AUTH-01, AUTH-02"
    verification:
      - kind: unit
        ref: "src/features/auth/auth-forms.test.tsx > LoginForm (3 tests: success+navigate, generic-error+no-reset-affordance, inline validation)"
        status: pass
    human_judgment: false
  - id: D4
    description: "SignupForm — field-level 'email already registered' error on a 409, generic banner on any other failure, inline Zod validation, cross-links to/from login (D-07), no password-reset affordance"
    requirement: "AUTH-01"
    verification:
      - kind: unit
        ref: "src/features/auth/auth-forms.test.tsx > SignupForm (4 tests: 409 field error, generic banner on 500, inline validation, no reset affordance)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Long organization-name input does not overflow the auth card horizontally (backstop — structural via Input's min-w-0 base class, no rendered visual check performed)"
    requirement: "AUTH-01"
    verification: []
    human_judgment: true
    rationale: "01-UI-SPEC.md flags this as a backstop requiring a rendered visual check ('insufficient_spec until confirmed') — this execution is non-interactive/headless and cannot perform a browser-rendered visual verification; the structural mitigation (Input's own min-w-0 w-full base class, unchanged from Plan 02) makes overflow unlikely but is not proof."

metrics:
  duration_minutes: 26
  completed: 2026-07-23
status: complete
---

# Phase 01 Plan 05: Login + Signup Screens Summary

Built the login and signup screens — Zod-validated react-hook-form forms on shadcn Field/Input/Button/Card, wired to a new `features/auth/api.ts` and the existing Zustand store/i18n runtime — enforcing the deliberately generic D-06 error contract and the D-05 "no password-reset anywhere" prohibition end-to-end, with a Rule-1 fix ensuring login/signup 401s never get misrouted through the shared client's token-refresh interceptor.

## Performance

- **Duration:** 26 min
- **Started:** 2026-07-23T09:07:23Z
- **Completed:** 2026-07-23T09:33:33Z
- **Tasks:** 2
- **Files modified:** 8 (6 created, 2 modified)

## Accomplishments

- `schemas.ts`: `loginSchema`/`signupSchema` mirror wheelio-api's `loginRequest`/`signupRequest` DTOs field-for-field (password `min(8)` matches the backend), proven by 8 unit tests.
- `api.ts`: typed `login()`/`signup()`/`logout()` — the first two deliberately bypass the shared refresh-interceptor client (see Deviations) so a genuine credentials failure never gets swallowed into an unrelated token-refresh attempt.
- `LoginForm.tsx`: email/password form; success stores tokens via `useAuthStore.setTokens` and navigates to `/`; submit button shows an inline spinner and disables itself for the request duration; ANY failure renders the identical generic `auth.loginError` copy — the code path structurally cannot distinguish "unknown email" from "wrong password" because it never inspects the caught error.
- `SignupForm.tsx`: organization_name/email/password/first_name/last_name form; a 409 from `/auth/signup` sets a field-level error on the email input (`auth.signupEmailInUse`); every other failure renders a generic banner (`auth.genericError`); cross-links to `/login` (D-07).
- `routes/login.tsx`, `routes/signup.tsx`: public TanStack Router file routes rendering the forms inside a centered card over the Stripe-like `auth-gradient-bg` band at 10% opacity, with the Spacing Scale's lg (24px) card-padding exception applied via a `[--card-spacing:1.5rem]` Tailwind arbitrary-property override.
- Extended Plan 04's i18n copy inventory with the field-label/placeholder/cross-link/generic-error strings this plan's screens actually needed (see Deviations) — both `fr` and `en` bundles updated, `npx vitest run src/shared/i18n` still 6/6 green.
- Verified no password-reset/forgot-password affordance exists anywhere in either form, in either language, via an explicit negative assertion in `auth-forms.test.tsx`.

## Task Commits

1. **Task 1: Zod schemas + auth feature API**
   - `18c3240` test(01-05): add failing test for auth Zod schemas
   - `63b6c2e` feat(01-05): implement loginSchema/signupSchema (AUTH-01, AUTH-02)
   - `2463e5f` feat(01-05): add auth feature API — login/signup/logout (AUTH-01, AUTH-02)
2. **Task 2: LoginForm + SignupForm + public routes**
   - `80f14a0` first commit claude — an out-of-band commit made directly by the user mid-execution (see Deviations) that swept up the RED `auth-forms.test.tsx` test file and the i18n copy-inventory extension alongside unrelated `.claude/skills/` and `.planning/config.json` changes already pending in the working tree.
   - `71c251a` feat(01-05): LoginForm + SignupForm + public /login /signup routes (AUTH-01, AUTH-02)

**Plan metadata:** committed separately (this SUMMARY + STATE.md/ROADMAP.md/REQUIREMENTS.md update)

## Files Created/Modified

- `src/features/auth/schemas.ts` — `loginSchema`, `signupSchema` (Zod, mirroring backend DTOs)
- `src/features/auth/schemas.test.ts` — 8 tests covering both schemas' accept/reject behavior
- `src/features/auth/api.ts` — `login()`/`signup()` (bare ky, bypass refresh interceptor), `logout()` (shared client)
- `src/features/auth/LoginForm.tsx` — email/password form, generic-only error, spinner, token storage + navigation
- `src/features/auth/SignupForm.tsx` — full signup form, 409-vs-generic error split, cross-link to login
- `src/features/auth/auth-forms.test.tsx` — 7 tests: login success/failure/validation, signup 409/generic/validation/no-reset-affordance
- `src/routes/login.tsx`, `src/routes/signup.tsx` — public routes, auth-gradient-bg band + centered lg-padded card
- `src/shared/i18n/fr/common.json`, `src/shared/i18n/en/common.json` — added field-label/placeholder/cross-link/generic-error keys under `auth.*`

## Decisions Made

- Bypassed the shared `api` client's refresh interceptor for `login()`/`signup()` — a Rule 1 bug fix, not a design preference; see Deviations for the full failure scenario this avoids.
- Extended the i18n copy inventory beyond what Plan 04 shipped — a Rule 2 addition; the inventory genuinely lacked field labels/placeholders/cross-link copy this plan's own prohibitions require routing through i18n.
- Left Zod's default (English) validation messages untranslated — out of scope per the Copywriting Contract's exact enumeration; not silently expanded further than the labels/cross-links Rule 2 already required.
- `auth.organizationNameLabel` uses "organisation" wording, not "agence", to keep the Organization/Agency domain distinction AUTH-04 depends on unambiguous.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] login()/signup() would have misrouted a genuine credentials failure through the shared client's token-refresh interceptor**
- **Found during:** Task 1, designing `api.ts` per the plan's literal instruction to route login/signup "through the shared ky client (plan 03)".
- **Issue:** `shared/api/client.ts`'s exported `api` instance has an `afterResponse` hook that treats ANY 401 response as "our access token expired" and attempts a `/auth/refresh`. wheelio-api's `/auth/login` and `/auth/signup` are unauthenticated endpoints that can legitimately return 401 on a genuine wrong-password login attempt. Routing that through `api` would: (a) if a stale `refreshToken` happens to still be in the Zustand store from an unrelated prior session, silently attempt to refresh/rotate that unrelated session's tokens as a side effect of a failed *new* login attempt; (b) if no refresh token exists (the common case on a public login screen), the hook's `refreshAccessToken()` throws a plain `Error("no refresh token")` from inside `afterResponse`, which ky propagates as the request's rejection — replacing the real 401 HTTPError with an unrelated, confusing error before the caller ever sees it.
- **Fix:** `login()`/`signup()` use a bare `ky.post(url, { json, baseUrl: API_URL })` call — the exact same pattern `client.ts`'s own `refreshAccessToken()` already uses to sidestep this class of problem. `logout()` keeps using the shared `api` client since it is a genuinely authenticated call that needs the Authorization header the shared client injects.
- **Files modified:** `src/features/auth/api.ts`.
- **Verification:** `auth-forms.test.tsx`'s "a failed login renders the generic error" test overrides the MSW `/auth/login` handler to return a bare 401 with no body and asserts the generic i18n string renders with `accessToken` still `null` — passing confirms the real 401 reaches `LoginForm`'s catch block undisturbed.
- **Committed in:** `2463e5f`

**2. [Rule 2 - Missing critical functionality] i18n copy inventory lacked form field labels, placeholders, and login/signup cross-link copy**
- **Found during:** Task 2, building `LoginForm.tsx`/`SignupForm.tsx` per the plan's own prohibition ("Do not ship bare JSX string literals; route all copy through i18n keys (plan 04)").
- **Issue:** Plan 04's `fr`/`en` `common.json` only defined `auth.loginCta`, `auth.signupCta`, `auth.loginError`, `auth.signupEmailInUse`, and `auth.sessionExpired` — no strings existed for "Email", "Mot de passe", the organization/first/last-name field labels, the email placeholder, page headings, the login<->signup cross-link prompts, or a generic (non-credentials) failure banner for signup's unexpected-error case. Building the forms without these would have forced either hardcoded literal JSX text (violating the plan's own explicit prohibition) or unlabeled/inaccessible form fields.
- **Fix:** Added `auth.emailLabel`, `auth.passwordLabel`, `auth.organizationNameLabel`, `auth.firstNameLabel`, `auth.lastNameLabel`, `auth.emailPlaceholder`, `auth.loginTitle`, `auth.signupTitle`, `auth.noAccountPrompt`/`auth.goToSignup`, `auth.hasAccountPrompt`/`auth.goToLogin`, and `auth.genericError` to both `fr/common.json` and `en/common.json`, following the existing nesting/naming convention.
- **Files modified:** `src/shared/i18n/fr/common.json`, `src/shared/i18n/en/common.json`.
- **Verification:** `npx vitest run src/shared/i18n` (6/6, unaffected) and `npx vitest run src/features/auth` (15/15, all copy resolved via `t()` — no literal strings in either form component).
- **Committed in:** `80f14a0` (the out-of-band commit — see note below) alongside the RED test file.

### Process Note (not a code deviation)

**Out-of-band commit mid-execution:** Partway through Task 2, the user made a manual commit (`80f14a0`, "first commit claude") directly from their own session, which swept up whatever was staged/modified in the working tree at that moment — the RED `auth-forms.test.tsx` test file and the two i18n JSON copy additions from this plan, plus an unrelated `.claude/skills/` directory and a pending `.planning/config.json` change that predated this plan's execution. This disrupted the intended one-commit-per-RED/GREEN-step granularity for Task 2 (the RED test commit and the i18n copy commit are not separately identifiable in history — both landed inside `80f14a0`), but does not affect correctness: the GREEN implementation commit (`71c251a`) that followed contains exactly the intended LoginForm/SignupForm/routes changes, and the full test/build verification below confirms nothing was lost or corrupted.

**Total deviations:** 2 auto-fixed (1 Rule 1 bug, 1 Rule 2 missing-functionality), 1 process note (commit granularity, no correctness impact).
**Impact on plan:** None on scope or acceptance criteria — both fixes were necessary to satisfy this plan's own must-have truths (D-05/D-06 generic-error contract; "route all copy through i18n keys" prohibition) and are independently proven by the 15 passing `src/features/auth` tests.

## Known Stubs

None. Every field is wired to real validation, the real `api.ts` calls, and the real Zustand store — no hardcoded empty/mock data anywhere in the rendered forms.

## Threat Flags

None beyond what 01-05-PLAN.md's own threat model already covers (T-01-enum: generic error copy verified by an explicit test; T-01-cred: password sent via HTTPS POST body, never logged, no `dangerouslySetInnerHTML` anywhere in either form; T-01-openredirect: no return-URL flow exists yet, accepted per the plan; T-01-input: Zod is a UX nicety, backend re-validates independently).

## Verification

- `npx vitest run src/features/auth` — 15/15 passing (8 schema tests + 7 form-behavior tests).
- `npx vitest run --reporter=dot` (full suite) — 9 test files, 48 tests, all passing (33 pre-existing from Plans 01-04 + 15 new).
- `npx tsc --noEmit` — exit 0.
- `npm run build` — exit 0 (login/signup routes code-split into their own chunks: `login-*.js` 2.21kB, `signup-*.js` 3.30kB gzipped).
- Backstop (long organization-name wrap): structural mitigation only (Input's `min-w-0 w-full`), no rendered visual check performed this execution — flagged as `human_judgment: true` in coverage (D5), matching the plan's own "insufficient_spec until confirmed" backstop policy.

## Issues Encountered

None beyond the two auto-fixed deviations documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `LoginForm`/`SignupForm`/`login()`/`signup()`/`logout()` are fully tested and ready for Plan 06 (role-aware shell) to build the `_authenticated` route guard's `beforeLoad`, which will redirect an unauthenticated user to `/login` and mount `AppShell` once a session (access token + resolved `/me` scope) exists.
- No blockers. Plan 06 should reuse this plan's i18n-key-driven copy pattern and the `[--card-spacing:1.5rem]` auth-screen padding override if it needs the same visual treatment anywhere in the shell chrome.

---
*Phase: 01-foundations-auth-shell-i18n-design-system*
*Completed: 2026-07-23*

## Self-Check: PASSED
