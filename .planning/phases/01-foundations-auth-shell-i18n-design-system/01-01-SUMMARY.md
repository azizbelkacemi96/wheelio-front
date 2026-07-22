---
phase: 01-foundations-auth-shell-i18n-design-system
plan: 01
subsystem: build-tooling-and-test-infra
tags: [vite, react19, typescript, tanstack-router, vitest, playwright, msw, dto-types]
requires: []
provides:
  - vite-react19-ts-scaffold
  - vitest-playwright-msw-harness
  - identity-dto-types
  - msw-auth-handlers
  - role-scope-fixtures
affects:
  - "01-02 (design system) mounts Tailwind/shadcn onto src/index.css and the folder skeleton"
  - "01-03 (auth core) builds shared/auth/store.ts + permissions.ts consuming src/types/identity.ts and src/test/fixtures/scope.ts"
  - "01-04..01-06 (shell, i18n, screens) all build on this scaffold, test harness, and DTO contract"
tech-stack:
  added:
    - "React 19.2.8 + react-dom 19.2.8"
    - "Vite 8.1.5 + @vitejs/plugin-react 6.0.4"
    - "TypeScript 7.0.2 (strict mode, @/* -> src/* path alias)"
    - "@tanstack/react-router 1.170.18 + @tanstack/router-plugin 1.168.23 (file-based routing)"
    - "@tanstack/react-query 5.101.4"
    - "zustand 5.0.14"
    - "i18next 26.3.6 + react-i18next 17.0.10 + i18next-browser-languagedetector 8.2.1"
    - "ky 2.0.2"
    - "tailwindcss 4.3.3 + @tailwindcss/vite 4.3.3"
    - "react-hook-form 7.82.0 + zod 4.4.3 + @hookform/resolvers 5.4.0"
    - "@fontsource-variable/inter 5.3.0, lucide-react 1.25.0, class-variance-authority 0.7.1, tailwind-merge 3.6.0, clsx 2.1.1"
    - "vitest 4.1.10 + @testing-library/react 16.3.2 + @testing-library/jest-dom 7.0.0 + @testing-library/user-event 14.6.1 + jsdom 29.1.1"
    - "msw 2.15.0"
    - "@playwright/test 1.61.1"
    - "@types/react 19.2.17 + @types/react-dom 19.2.3 (added — TS7 no longer bundles ambient module declarations for untyped JS packages the way earlier TS did; required for tsc to resolve React's module shape)"
  patterns:
    - "src/test/mocks/server.ts (setupServer) + src/test/setup.ts (beforeAll/afterEach/afterAll, onUnhandledRequest:'error') — every Vitest file inherits the mocked wheelio-api contract automatically via vitest.config.ts's setupFiles"
    - "src/types/identity.ts is a 1:1 mirror of wheelio-api's dto.go/roles.go, with a header comment pointing back to the Go source as the source of truth — MSW handler bodies are typed against these interfaces so contract drift fails compilation"
    - "src/test/fixtures/scope.ts exports RoleFixture (me: MeResponse, agencies: AgencyResponse[]) for agent/manager/owner — owner fixture is multi-agency to cover the switcher tests up front"
    - "scripts/generate-routes.mjs + npm postinstall/predev/prebuild/pretest hooks guarantee src/routeTree.gen.ts (gitignored, TanStack Router codegen output) exists before any tsc/vitest/vite invocation on a bare-clone checkout"
key-files:
  created:
    - package.json
    - package-lock.json
    - tsconfig.json
    - tsconfig.node.json
    - vite.config.ts
    - vitest.config.ts
    - playwright.config.ts
    - index.html
    - .gitignore
    - .env.example
    - scripts/generate-routes.mjs
    - src/main.tsx
    - src/index.css
    - src/vite-env.d.ts
    - src/routes/__root.tsx
    - src/routes/index.tsx
    - src/test/setup.ts
    - src/test/setup.smoke.test.ts
    - src/test/mocks/server.ts
    - src/test/mocks/handlers.ts
    - src/test/mocks/handlers.test.ts
    - src/test/fixtures/scope.ts
    - src/types/identity.ts
  modified: []
decisions:
  - "Pinned every package to the exact version 01-RESEARCH.md verified live against npm (react 19.2.8, vite 8.1.5, typescript 7.0.2, @tanstack/react-router 1.170.18, tailwindcss 4.3.3, etc.) rather than using caret ranges, so the scaffold matches what was legitimacy-audited."
  - "Added @types/react + @types/react-dom (not in 01-RESEARCH.md's install list) because TypeScript 7 could not resolve React's module shape without them — a Rule 2 addition (missing critical functionality: the app does not compile without this)."
  - "Added scripts/generate-routes.mjs + postinstall/predev/prebuild/pretest npm hooks — a Rule 1 bug fix. The plan's literal build script (`tsc -b && vite build`) breaks on a bare-clone checkout: src/routeTree.gen.ts is gitignored (per the plan's own instruction) and is only regenerated as a side effect of running Vite itself, so a fresh `npx tsc --noEmit` or the tsc step of `npm run build` fails with 'Cannot find module ./routeTree.gen' before Vite ever runs. The fix uses @tanstack/router-generator's programmatic API (no CLI binary is published for this router-plugin version) to pregenerate the route tree, wired to run automatically after `npm install` and before dev/build/test — restoring the exact bare-clone-buildable guarantee the plan's own must_haves require."
  - "Adapted tsconfig.json/tsconfig.node.json for TypeScript 7 breaking changes not anticipated in 01-RESEARCH.md: `baseUrl` was removed (paths must use './' prefix directly), and a referenced composite project may not set `noEmit` (switched to `emitDeclarationOnly` + explicit `outDir` for tsconfig.node.json)."
  - "Task 2's src/test/mocks/server.ts imports from ./handlers per the plan's documented seam ('handlers file is created in Task 3'); committed a minimal empty-array handlers.ts stub in the Task 2 commit so Task 2's own verification (`npx vitest run --reporter=dot`) is green, then Task 3 replaced it with the real typed handlers — avoids a broken intermediate commit."
  - "Kept the owner fixture as the single multi-agency fixture (2 agencies: Alger + Oran) rather than adding a separate single-agency owner variant — satisfies both the three-role-shape requirement and the 'at least one multi-agency owner fixture' requirement in one fixture, per 01-RESEARCH.md Assumption A2 (zero-agency edge case is out of scope for Wave 0)."
metrics:
  duration_minutes: 12
  completed: 2026-07-22
status: complete
---

# Phase 01 Plan 01: Vite Scaffold, Test Harness, DTO Types & Scope Fixtures Summary

Scaffolded the greenfield Vite + React 19 + TypeScript SPA with a buildable skeleton, a green Vitest/Playwright/MSW test harness, DTO types mirroring wheelio-api's auth/identity contract exactly, and per-role (agent/gérant/owner) `/me` fixtures — the Wave 0 prerequisite every later Phase 1 plan (design system, auth core, i18n, shell) mounts onto.

## What Was Built

**Task 1 — Scaffold Vite + React 19 + TypeScript app and build tooling**
Created `package.json` with the full runtime/dev dependency set pinned to the exact versions verified live in 01-RESEARCH.md's Package Legitimacy Audit (react 19.2.8, vite 8.1.5, typescript 7.0.2, @tanstack/react-router 1.170.18, @tanstack/react-query 5.101.4, zustand 5.0.14, i18next 26.3.6/react-i18next 17.0.10, ky 2.0.2, tailwindcss 4.3.3, react-hook-form 7.82.0/zod 4.4.3, @fontsource-variable/inter 5.3.0, lucide-react/cva/tailwind-merge/clsx, and the vitest/testing-library/msw/playwright dev set). Configured `tsconfig.json` (strict, `@/*` -> `src/*`) and `tsconfig.node.json` (vite/vitest/playwright configs), `vite.config.ts` (React plugin, `@tailwindcss/vite`, `@tanstack/router-plugin` file-based routing with `routesDirectory: src/routes` / `generatedRouteTree: src/routeTree.gen.ts`), `index.html`, `src/main.tsx` (minimal `RouterProvider` skeleton), `src/index.css` (`@import "tailwindcss";` only), `src/vite-env.d.ts` (typed `VITE_API_URL`), `.env.example`, and the empty folder skeleton (`src/app/shell`, `src/features/auth`, `src/shared/{api,auth,ui,i18n}`, `src/types`, `src/test`). Added npm scripts `dev`, `build`, `preview`, `test`, `test:e2e`.

**Task 2 — Configure Vitest + Playwright + MSW test harness**
Created `vitest.config.ts` (jsdom, globals, `setupFiles: ['src/test/setup.ts']`, shared `@/*` alias, default reporter, no watch flags), `playwright.config.ts` (chromium project, `webServer` running the built app via `npm run preview` on port 4173 — deliberately not tied to `VITE_API_URL`, which is the wheelio-api backend origin, an unrelated concern), `src/test/mocks/server.ts` (`setupServer(...handlers)`), and `src/test/setup.ts` (jest-dom matchers + MSW `beforeAll(listen)/afterEach(resetHandlers)/afterAll(close)` with `onUnhandledRequest: 'error'`). Added `src/test/setup.smoke.test.ts` as the harness's first green test.

**Task 3 — API DTO types, MSW handlers, and per-role Scope fixtures**
Created `src/types/identity.ts` mirroring wheelio-api's `dto.go`/`roles.go` 1:1: `UserResponse`, `OrganizationResponse`, `AgencyResponse`, `MembershipResponse`, `MeResponse`, `AuthResponse`, plus the `OrgRole`/`AgencyRole` string-literal unions (confirmed byte-for-byte against the Go source, not inferred). Created `src/test/mocks/handlers.ts` with typed MSW handlers for `POST /auth/login`, `/auth/signup`, `/auth/refresh` (rotated tokens, same `authResponse` shape per `auth_handler.go`), `/auth/logout` (204), `GET /me`, `GET /agencies` — all reading their base URL from `VITE_API_URL`. Created `src/test/fixtures/scope.ts` exporting `RoleFixture` objects for agent (single agency, `agent` role), gérant/manager (single agency, `manager` role), and owner (`org_role: 'owner'`, empty explicit memberships, two agencies for switcher coverage). Added `src/test/mocks/handlers.test.ts` exercising every handler through the real MSW server and asserting fixture role shapes.

## Verification

- `npx tsc --noEmit` — exit 0 (verified from a simulated bare-clone state: deleted `src/routeTree.gen.ts`, `dist/`, and `node_modules/.tmp` before each check).
- `npm run build` — exit 0, produces `dist/` (`index.html`, CSS, JS chunks).
- `npx vitest run --reporter=dot` — 2 test files, 8 tests, all passing, MSW server active with `onUnhandledRequest: 'error'`, total duration ~700ms (well under the 90s budget).
- `package.json` contains no `i18next-icu` and no `next-themes` entry (prohibition satisfied).
- Owner fixture asserted `org_role === 'owner'`; agent/manager fixtures asserted their respective membership roles via `handlers.test.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Bare-clone build was broken by a routeTree.gen.ts chicken-and-egg gap**
- **Found during:** Task 1, verifying the literal `npm run build` script (`tsc -b && vite build`) against a simulated fresh clone.
- **Issue:** `src/routeTree.gen.ts` is gitignored per the plan's own instruction, and is only regenerated as a side effect of running Vite (dev server or `vite build`). `tsc -b` runs as a separate process before Vite ever starts, so on a truly bare clone (`npm install` only, no prior `vite dev`), both a standalone `npx tsc --noEmit` and the `tsc -b` step of `npm run build` fail with `Cannot find module './routeTree.gen'` — directly contradicting the plan's own must_have ("`npm run build` produces a bundle from a bare-clone checkout").
- **Fix:** Added `scripts/generate-routes.mjs`, a small script using `@tanstack/router-generator`'s programmatic `Generator`/`getConfig` API (no standalone CLI binary is published for this router-plugin version) to pregenerate the route tree. Wired as `postinstall`, `predev`, `prebuild`, and `pretest` npm scripts so the file always exists before any command that needs it, on a truly bare clone.
- **Files modified:** `package.json` (added `generate-routes`/`postinstall`/`predev`/`prebuild`/`pretest` scripts), `scripts/generate-routes.mjs` (new).
- **Commit:** 635d7f5

**2. [Rule 2 - Missing critical functionality] TypeScript 7 could not resolve React's module shape**
- **Found during:** Task 1, running `npx tsc --noEmit` for the first time.
- **Issue:** `react`, `react-dom/client`, and `react/jsx-runtime` all resolved to implicit `any` (TS7016) — TypeScript 7.0.2 has no ambient declarations for these packages without `@types/react`/`@types/react-dom` installed; the app could not typecheck at all.
- **Fix:** Added `@types/react@19.2.17` and `@types/react-dom@19.2.3` to devDependencies (versions verified live against npm, matching the installed React 19.2.8).
- **Files modified:** `package.json`.
- **Commit:** 635d7f5

**3. [Rule 1 - Bug] TypeScript 7 tsconfig breaking changes not anticipated in 01-RESEARCH.md**
- **Found during:** Task 1, running `npx tsc --noEmit`.
- **Issue:** TS7 removed `baseUrl` support (TS5102) and disallows a referenced composite project from setting `noEmit` (TS6310) — both used in the initially-drafted `tsconfig.json`/`tsconfig.node.json`.
- **Fix:** Removed `baseUrl`, changed `paths` to use an explicit `./src/*` relative prefix; changed `tsconfig.node.json` from `noEmit: true` to `emitDeclarationOnly: true` with an explicit `outDir`.
- **Files modified:** `tsconfig.json`, `tsconfig.node.json`.
- **Commit:** 635d7f5

**4. [Plan gap closure] Task 2/Task 3 seam required a stub handlers.ts**
- **Found during:** Task 2, running `npx vitest run --reporter=dot`.
- **Issue:** The plan explicitly documents `src/test/mocks/server.ts` importing from `./handlers` as a seam ("handlers file is created in Task 3"), but Task 2's own verification command (`npx vitest run --reporter=dot`) would fail on the dangling import until Task 3 lands.
- **Fix:** Committed a minimal `export const handlers: HttpHandler[] = [];` stub as part of the Task 2 commit so its own verification passes standalone; Task 3 then replaced the stub with the full typed handler set (not a fresh create, a modification — reflected in the Task 3 commit's diff stat).
- **Files modified:** `src/test/mocks/handlers.ts` (created in Task 2, replaced in Task 3).
- **Commits:** 99460df (stub), fc97d26 (real implementation)

No architectural deviations (Rule 4) were needed — everything above was a bug fix, missing-critical-functionality addition, or a documented plan-gap closure, all within this plan's own file scope.

## Known Stubs

None. `src/routes/index.tsx` is an intentionally temporary landing page per the plan's own instruction ("temporary landing"), replaced by the real dashboard/shell in a later plan (01-04 per 01-RESEARCH.md's project structure) — not a stub masking missing functionality.

## Self-Check: PASSED
