---
phase: 1
slug: foundations-auth-shell-i18n-design-system
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-22
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (unit/component) + Playwright 1.61.1 (E2E) + @testing-library/react + MSW |
| **Config file** | none yet — Wave 0 installs |
| **Quick run command** | `npx vitest run --reporter=dot` |
| **Full suite command** | `npx vitest run && npx playwright test` |
| **Estimated runtime** | ~30 seconds (unit) + ~60 seconds (E2E) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run` (targeted to touched files)
- **After every plan wave:** Run `npx vitest run && npx playwright test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 0 | AUTH-01 | — | Test framework + MSW handlers + Scope fixtures installed | infra | n/a | ❌ W0 | ⬜ pending |
| 01-0x-0x | TBD | TBD | AUTH-01 | — | Login succeeds; tokens stored correctly (access in memory, refresh persisted) | unit + integration (MSW) | `npx vitest run src/features/auth` | ❌ W0 | ⬜ pending |
| 01-0x-0x | TBD | TBD | AUTH-01 | T-01-refresh | Concurrent 401s trigger exactly one refresh call (single-flight) | unit (mock ky + fake timers) | `npx vitest run src/shared/api/client.test.ts` | ❌ W0 | ⬜ pending |
| 01-0x-0x | TBD | TBD | AUTH-02 | T-01-refresh | Refresh failure redirects to login with correct copy; refresh success never redirects | integration (MSW + router test harness) | `npx vitest run src/app/router.test.tsx` | ❌ W0 | ⬜ pending |
| 01-0x-0x | TBD | TBD | AUTH-03 | T-01-rbac | Nav renders base items for all roles; 3 admin sections only for org admins | component (Testing Library, scope fixture) | `npx vitest run src/app/shell/AppShell.test.tsx` | ❌ W0 | ⬜ pending |
| 01-0x-0x | TBD | TBD | AUTH-04 | — | Switching agency updates `currentAgencyId` without a new `/me`/`/auth/refresh` call | unit (Zustand store + MSW call-count assertion) | `npx vitest run src/shared/auth/store.test.ts` | ❌ W0 | ⬜ pending |
| 01-0x-0x | TBD | TBD | AUTH-05 | — | FR default renders; language switch updates all visible strings instantly; French plural at count=0 renders singular | component + snapshot | `npx vitest run src/shared/i18n` | ❌ W0 | ⬜ pending |
| 01-0x-0x | TBD | TBD | AUTH-06 | — | Dark/light theme toggle updates `.dark` class and persists across reload | component (jsdom + localStorage mock) | `npx vitest run src/shared/ui/theme-provider.test.tsx` | ❌ W0 | ⬜ pending |
| 01-0x-0x | TBD | TBD | AUTH-01/02/03 | T-01-rbac | Full login → shell → role-gated nav happy path (E2E) | E2E | `npx playwright test e2e/auth.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs/waves are placeholders — the planner assigns final Task IDs; this map's requirement→test coverage must be preserved when it does.*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` + `vite.config.ts` test block — no test framework exists yet (greenfield repo)
- [ ] `playwright.config.ts` — E2E framework config
- [ ] `src/test/setup.ts` — jest-dom matchers, MSW server bootstrap
- [ ] `src/test/mocks/handlers.ts` — MSW handlers mirroring `authResponse`/`meResponse`/`agencyResponse` shapes (confirmed against `wheelio-api` source in 01-RESEARCH.md)
- [ ] `src/test/fixtures/scope.ts` — reusable `Scope` fixtures per role (agent/manager/owner) for `permissions.ts` and `AppShell` tests
- [ ] Framework install: `npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom msw @playwright/test`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual dark/light theme correctness (contrast, no FOUC) | AUTH-06 | Automated test confirms the `.dark` class toggles and persists, but actual visual correctness (contrast, no flash-of-unstyled-content) needs a human look, per D-02/D-01 | Toggle theme in the running app; confirm no flash on reload, both themes match UI-SPEC.md's declared color tokens |
| "Hidden button, call the API directly" spot-check | AUTH-03 | Frontend `permissions.ts` is UX-only (ASVS V4) — must confirm the backend independently rejects an action a hidden-in-UI role attempts via direct API call, not just that the UI hides it | As agent/manager, attempt a direct `curl`/Postman call to an owner-only endpoint (e.g., organization fiscal-identity) with the agent's token; confirm 403/404, not 200 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
