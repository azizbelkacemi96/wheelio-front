---
phase: 01-foundations-auth-shell-i18n-design-system
plan: 04
subsystem: i18n
tags: [i18next, react-i18next, cldr-plurals, fr-en, locale-switch]

requires:
  - phase: 01-01
    provides: vite-react19-ts-scaffold
provides:
  - i18next-fr-default-runtime
  - use-locale-switch-hook
  - phase1-copy-inventory-fr-en
affects:
  - "01-06 (shell): index.ts imported once by the app providers; NavRail/TopBar/AppShell read strings via react-i18next useTranslation and the nav/admin i18n keys defined here"
  - "01-05 (auth screens): login/signup CTA and error copy consumed via i18n keys defined here"
  - "01-07 (placeholder routes): empty-state heading/body keys consumed by EmptyState component"

tech-stack:
  added: []
  patterns:
    - "src/shared/i18n/index.ts: single i18next init, fallbackLng 'fr' as the hard default; LanguageDetector's detection.order is restricted to ['localStorage'] only (no navigator/cookie/querystring/htmlTag) so nothing-stored always resolves to FR — an explicit useLocale().setLocale(...) call is the ONLY thing that can ever override the default, and i18next's own changeLanguage flow persists that choice via the detector's cacheUserLanguage"
    - "src/shared/i18n/useLocale.ts: useSyncExternalStore subscribed to i18n's 'languageChanged' event — the idiomatic React 19 way to read an external (non-React-state) source of truth, returning { locale, setLocale }"
    - "v4 JSON plural key suffixes (_one/_other) throughout fr/en common.json, e.g. vehicleCount_one/vehicleCount_other — Intl.PluralRules-backed, never a hand-rolled count === 1 ternary"
    - "Copy is organized by role under nested JSON keys (auth.*, shell.*, emptyState.*, nav.*, nav.admin.*) mirroring 01-UI-SPEC.md's Copywriting Contract sections 1:1, so downstream components (login form, AppShell, NavRail, EmptyState) each import a scoped subset via useTranslation(...)"

key-files:
  created:
    - src/shared/i18n/index.ts
    - src/shared/i18n/useLocale.ts
    - src/shared/i18n/fr/common.json
    - src/shared/i18n/en/common.json
    - src/shared/i18n/i18n.test.ts
  modified:
    - tsconfig.json

decisions:
  - "[Rule 1 - Bug] Restricted i18next-browser-languagedetector's detection.order to ['localStorage'] only, diverging from 01-RESEARCH.md's literal code sample (which specifies no `detection` option at all, meaning the library's own default order — querystring, cookie, localStorage, sessionStorage, navigator, htmlTag — applies). Verified against the installed detector's source (node_modules/i18next-browser-languagedetector): with the default order, a fresh browser session with nothing stored would fall through to the 'navigator' detector and pick up the OS/browser's Accept-Language (e.g. 'en-US'), setting i18next's active `lng` directly and bypassing `fallbackLng: 'fr'` entirely — a direct contradiction of this plan's own must_have truth ('French is the hard default... the browser language detector is only a hint and never overrides FR when nothing is explicitly stored'). Restricting `order` to `['localStorage']` means detection only ever recognizes a PREVIOUSLY, EXPLICITLY stored choice (written by useLocale().setLocale via i18next's own changeLanguage->cacheUserLanguage flow); with nothing stored, detect() yields nothing and fallbackLng 'fr' applies, exactly matching the required behavior. `caches: ['localStorage']` is unaffected and still persists every explicit choice."
  - "Added `resolveJsonModule: true` to tsconfig.json — required for `import fr from \"./fr/common.json\"` (per 01-RESEARCH.md's own code example) to typecheck; not previously enabled in the Plan 01 scaffold since no prior file imported JSON directly. A Rule 2 addition (missing critical functionality — the plan's own example doesn't compile without it)."
  - "useLocale().setLocale returns `Promise<void>` (awaiting i18n.changeLanguage) rather than being fire-and-forget void, so callers/tests can deterministically await the locale swap; components may still call it without awaiting since changeLanguage is synchronous for the bundled (no-backend) resources in this project."
  - "Copy keys are nested by role (auth.loginCta, nav.admin.fiscalIdentity, etc.) rather than flat keys — no CONTEXT.md/UI-SPEC.md preference was stated either way; nesting was chosen for readability given the copy inventory already groups naturally into auth/shell/emptyState/nav sections, and react-i18next's dot-path key resolution supports this without configuration."
  - "English admin-section labels (nav.admin.fiscalIdentity/agencies/billing) are not verbatim-specified anywhere in 01-UI-SPEC.md or 01-RESEARCH.md (only the FR labels + a CONTEXT.md English paraphrase 'fiscal identity, agency management, cross-agency billing' exist) — used that CONTEXT.md paraphrase directly as the EN copy ('Company fiscal identity', 'Agency management', 'Cross-agency billing') since it is the only EN source language available; flagged here for confirmation rather than silently invented from scratch."

metrics:
  duration_minutes: 25
  completed: 2026-07-23
status: complete
---

# Phase 01 Plan 04: i18next Runtime, Locale Switch Hook & Phase-1 Copy Inventory Summary

Wired the i18next runtime FR-default/EN-switchable (AUTH-05) with a detector configuration that makes FR a true hard default (never guessed from the browser), a `useLocale()` hook for instant client-side locale swaps, and the full Phase-1 copy inventory (auth CTAs/errors, shell `/me`-error+retry, empty-state, base nav + 3 owner-only admin sections) in both `fr`/`en`, proven correct — including the French CLDR count-0-is-singular pitfall — by a 6-test suite.

## What Was Built

**Task 1 — i18next init (FR default, v4 plurals) + fr/en resource bundles**
Created `src/shared/i18n/index.ts`: `i18n.use(LanguageDetector).use(initReactI18next).init({...})` with `resources: { fr: { common }, en: { common } }`, `fallbackLng: "fr"`, `ns: ["common"]`, `defaultNS: "common"`, `interpolation.escapeValue: false`. No `compatibilityJSON`, no `i18next-icu`. Created `src/shared/i18n/fr/common.json` and `en/common.json` with the full Phase-1 copy inventory nested under `auth.*` (login/signup CTA, login error, signup-email-in-use, session-expiry), `shell.*` (`/me` error + "Réessayer"/"Retry"), `emptyState.*` (heading/body), `nav.*` (Aujourd'hui/Véhicules/Clients/Contrats/États des lieux + `nav.admin.*` for the 3 owner-only sections: Identité fiscale société/Gestion agences/Facturation transverse), and a `vehicleCount_one`/`vehicleCount_other` v4 plural sample key. Added `resolveJsonModule: true` to `tsconfig.json` (required for the JSON imports; see Deviations).

**Task 2 — useLocale switch hook + i18n behavior tests**
Created `src/shared/i18n/useLocale.ts`: a `useSyncExternalStore`-based hook subscribed to i18next's `languageChanged` event, returning `{ locale, setLocale }` where `setLocale` awaits `i18n.changeLanguage`. Created `src/shared/i18n/i18n.test.ts` (6 tests): (1) a fresh module instance (via `vi.resetModules()` + dynamic import, simulating a real fresh page load) resolves French with nothing stored; (2) an explicit `changeLanguage("en")` persists across a second simulated fresh boot; (3) `i18n.changeLanguage` swaps every tested key from FR to EN synchronously (no network — MSW's `onUnhandledRequest: 'error'` from the shared test harness would fail the suite if i18next ever attempted a backend fetch); (4) `useLocale().setLocale` re-renders a hook consumer with the new locale; (5)/(6) French renders `"0 véhicule"`/`"1 véhicule"` (singular) and `"2 véhicules"` (plural), English renders `"0 vehicles"`/`"1 vehicle"`/`"2 vehicles"`.

## Verification

- `npx tsc --noEmit` — exit 0.
- `npx vitest run src/shared/i18n` — 6/6 passing, no `act()` warnings (fixed by wrapping the describe-block's `afterEach` locale-reset in `act()` — a still-mounted `renderHook` component from the previous test was being updated outside an act boundary; see below).
- `npx vitest run --reporter=dot` (full suite) — 7 test files, 33 tests, all passing (27 pre-existing from Plans 01-03 + 6 new).
- `npm run build` — exit 0.
- Confirmed no `compatibilityJSON` and no `i18next-icu` import anywhere in the tree.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Default language-detector order would let the browser's Accept-Language override the FR hard default**
- **Found during:** Task 1, reading `node_modules/i18next-browser-languagedetector`'s source to confirm behavior before wiring the config, per this plan's own must_have truth ("the browser language detector is only a hint and never overrides FR when nothing is explicitly stored").
- **Issue:** 01-RESEARCH.md's literal code example passes no `detection` option to `.init()`. The installed detector's default `order` is `['querystring', 'cookie', 'localStorage', 'sessionStorage', 'navigator', 'htmlTag']`. With nothing stored, detection falls through to `'navigator'`, which reads `navigator.language` — in a real browser this could be `'en-US'` — and i18next sets `lng` directly from that detected value, entirely bypassing `fallbackLng: 'fr'`. This directly contradicts the plan's own must-have truth.
- **Fix:** Configured `detection: { order: ['localStorage'], caches: ['localStorage'], lookupLocalStorage: LOCALE_STORAGE_KEY }` in `index.ts`. Verified against i18next core's `changeLanguage` source that `services.languageDetector.cacheUserLanguage(l)` fires synchronously on every explicit `changeLanguage` call regardless of `order`, so persistence (`caches`) is unaffected by narrowing `order`. With nothing in localStorage, `detect()` now returns nothing and `fallbackLng: 'fr'` applies — matching the required behavior exactly. Covered by `i18n.test.ts`'s first two tests (fresh-instance FR default; persistence across a simulated fresh boot).
- **Files modified:** `src/shared/i18n/index.ts`.
- **Commit:** ce458e2

**2. [Rule 2 - Missing critical functionality] JSON resource imports did not typecheck**
- **Found during:** Task 1, running `npx tsc --noEmit` after creating `index.ts`'s `import fr from "./fr/common.json"` (per 01-RESEARCH.md's own code example).
- **Issue:** `resolveJsonModule` was not enabled in the Plan 01 scaffold's `tsconfig.json` (no prior file imported JSON directly), so both JSON imports failed with `Cannot find module './fr/common.json'`.
- **Fix:** Added `"resolveJsonModule": true` to `tsconfig.json`'s `compilerOptions`.
- **Files modified:** `tsconfig.json`.
- **Commit:** ce458e2

**3. [Rule 1 - Bug] act() warning from a still-mounted renderHook component during describe-block cleanup**
- **Found during:** Task 2, running `npx vitest run src/shared/i18n` — passed but printed "An update to TestComponent was not wrapped in act(...)".
- **Issue:** The `locale switch is instant...` describe block's local `afterEach` called `await i18n.changeLanguage("fr")` to reset state for the next test. Testing Library's own automatic `cleanup()` (registered as an `afterEach` at import time, which runs after this file's locally-declared `afterEach` per hook registration order) hadn't yet unmounted the previous test's `renderHook`-mounted component, so the `changeLanguage` call's synchronous `languageChanged` emit re-rendered a component that React considered "outside any test" from `act()`'s perspective.
- **Fix:** Wrapped the describe block's `afterEach` `changeLanguage` call in `act(async () => { ... })`.
- **Files modified:** `src/shared/i18n/i18n.test.ts`.
- **Commit:** c11fbaa

No architectural deviations (Rule 4) were needed — both substantive fixes were required specifically to satisfy this plan's own must_have truths (FR hard default) and its own literal code example's compile requirement, and the third was a test-hygiene fix within this plan's own file scope.

## Known Stubs

None. Every key defined here is either already consumed by an existing component (none yet — this plan only wires the runtime and copy; Plan 06 wires the app providers and Plan 05/07 consume the auth/nav/empty-state keys) or is the explicitly-scoped v4 plural convention sample (`vehicleCount_one`/`_other`) the plan itself calls for as groundwork, not a placeholder masking missing functionality.

## Threat Flags

None beyond what 01-04-PLAN.md's own threat model already covers (T-01-i18n-xss: `escapeValue: false` is safe because React escapes JSX and no translation string is rendered via `dangerouslySetInnerHTML` — unchanged, no new render surface introduced by this plan; T-01-locale: `localStorage`-persisted locale preference — accepted risk, unchanged).

## Self-Check: PASSED
