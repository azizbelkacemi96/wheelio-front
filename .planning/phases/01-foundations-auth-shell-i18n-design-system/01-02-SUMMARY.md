---
phase: 01-foundations-auth-shell-i18n-design-system
plan: 02
subsystem: design-system-tokens
tags: [shadcn, tailwindcss-v4, theme-provider, design-tokens, dark-mode, radix-ui]
requires:
  - vite-react19-ts-scaffold
provides:
  - shadcn-design-token-system
  - vite-theme-provider
  - base-shadcn-component-library
affects:
  - "01-03 (auth core): login/signup screens compose button/input/label/field/card"
  - "01-04 (shell): nav/topbar compose dropdown-menu/avatar/separator/sheet/tooltip; ThemeProvider wraps app root"
  - "01-05..01-06 (i18n, screens): all consume the tokenised src/index.css and src/shared/ui/* components"
tech-stack:
  added:
    - "shadcn CLI 4.14.0 (radix-nova preset, base: radix, template: vite) — a fully redesigned CLI vs the style/baseColor paradigm 01-RESEARCH.md/01-UI-SPEC.md assumed (see Deviations)"
    - "radix-ui 1.6.4 (single meta-package, replaces per-primitive @radix-ui/react-* imports)"
    - "sonner 2.0.7 (toast, shadcn's vendored Toaster wrapper)"
    - "tw-animate-css 1.4.0 (Tailwind v4 animate utilities used by dropdown-menu/sheet/tooltip enter/exit states)"
    - "shadcn 4.14.0 as a runtime dependency (ships shadcn/tailwind.css, imported once from src/index.css — official base reset/utility layer for this CLI generation)"
  patterns:
    - "src/index.css: @theme inline maps every semantic CSS variable (--color-*) to :root/.dark-scoped custom properties (--background, --primary, --success, --warning, ...) — one source of truth per AUTH-06, consumed via bg-primary/text-foreground/etc., never a hardcoded hex per component"
    - "src/index.css: plain @theme block (not @theme inline, since values are theme-independent) defines the spacing scale (--spacing-xs..3xl + --spacing-row-x/--spacing-touch exceptions) and the 4-role typography scale (--text-label/body/heading/display, each paired with --text-*--line-height) — Tailwind v4 auto-generates p-xs/gap-lg/size-touch/text-heading utilities from these theme keys"
    - "@utility numeric-cell (tabular-nums) and @utility auth-gradient-bg (var(--gradient-auth)) — Tailwind v4's first-class custom-utility mechanism, reusable by Phase 2+ mileage/DZD table cells and the Phase 1 Plan 05 auth screens"
    - "components.json aliases.ui rewritten to @/shared/ui (CLI default is @/components/ui) so all vendored components land in this project's documented folder structure (01-RESEARCH.md Recommended Project Structure)"
key-files:
  created:
    - components.json
    - src/lib/utils.ts
    - src/shared/ui/theme-provider.tsx
    - src/shared/ui/theme-provider.test.tsx
    - src/shared/ui/button.tsx
    - src/shared/ui/input.tsx
    - src/shared/ui/label.tsx
    - src/shared/ui/field.tsx
    - src/shared/ui/card.tsx
    - src/shared/ui/dropdown-menu.tsx
    - src/shared/ui/avatar.tsx
    - src/shared/ui/separator.tsx
    - src/shared/ui/sonner.tsx
    - src/shared/ui/skeleton.tsx
    - src/shared/ui/badge.tsx
    - src/shared/ui/sheet.tsx
    - src/shared/ui/tooltip.tsx
  modified:
    - src/index.css
    - package.json
    - package-lock.json
    - vitest.config.ts
decisions:
  - "shadcn CLI has moved to v4.14.0's 'preset' system (Nova/Vega/Maia/.../Custom + base library choice of base/radix/aria) — the style: new-york / baseColor: slate flags 01-RESEARCH.md and 01-UI-SPEC.md assumed no longer exist in this CLI generation. Ran init with the Nova preset (matches our lucide-react icon choice) and base: radix (matches 01-UI-SPEC.md's Radix UI primitives requirement), then discarded every preset-supplied color/font value and hand-wrote 01-UI-SPEC.md's exact hex tokens under :root/.dark — the CLI's own generated variable NAMES (--background, --primary, --secondary, --muted, --accent, --destructive, --border, --input, --ring, --card, --popover) matched the shadcn convention 01-RESEARCH.md expected, so the token-mapping architecture is unaffected even though the preset mechanism that produced the scaffold differs from what was researched."
  - "shadcn's structural '--accent' CSS variable (used by components for neutral hover/active highlight states) is intentionally NOT set to the UI-SPEC blue brand color. 01-UI-SPEC.md's own 'Accent (10%)' token is the blue brand color reserved for CTAs/links/focus rings/active-nav-indicator — mapped to shadcn's '--primary'/'--ring' variables instead, which is what button/link/focus-ring components actually consume. Overloading shadcn's '--accent' with blue would have painted every ghost-button/menu-item hover state blue, blowing UI-SPEC's explicit 10%-budget/never-a-general-background-fill rule."
  - "01-UI-SPEC.md's 'form' shadcn component is the deprecated pre-v4 form.tsx (Form/FormField/FormItem/FormControl/FormMessage wrapping react-hook-form). This CLI's official registry now ships 'field' (Field/FieldLabel/FieldDescription/FieldError/FieldGroup/FieldSet) as its replacement — the 'form' registry entry itself resolves to an empty stub with no file content. Vendored field.tsx instead of form.tsx; it is the same official-registry capability (form-field composition primitives) under a new upstream name, not a different library or a third-party registry."
  - "Fixed the vendored sonner.tsx's next-themes import (shadcn's current template imports next-themes for toast theme sync) to use this repo's own theme-provider useTheme() instead — next-themes is explicitly prohibited by this plan and was never intended to enter the dependency tree; uninstalled it immediately (along with the CLI's default @fontsource-variable/geist, replaced with the already-installed Inter)."
  - "Added muted-foreground (slate-500/400) and popover/popover-foreground (mirroring card) as reasonable interpolations — 01-UI-SPEC.md's Color table doesn't enumerate every shadcn structural role explicitly, only the 60/30/10 dominant/secondary/accent roles plus Success/Warning/Border. These two are conservative, spec-consistent extensions (same slate family, same light/dark pairing logic) rather than new colors."
  - "Fixed a pre-existing Node 22+/jsdom incompatibility in the test harness: Node's experimental global `localStorage` (on by default in this Node 26 environment) shadows jsdom's window.localStorage inside Vitest's worker processes, making ANY test that touches localStorage fail with 'Cannot read properties of undefined'. Added `execArgv: [\"--no-experimental-webstorage\"]` to vitest.config.ts's top-level test config (Vitest 4's replacement for the removed poolOptions.forks/threads.execArgv) — required for theme-provider.test.tsx's own mandated verification to pass, and unblocks every future test in this project that reads/writes localStorage (e.g. the auth store's persisted refresh token, Plan 03)."
metrics:
  duration_minutes: 55
  completed: 2026-07-23
status: complete
---

# Phase 01 Plan 02: shadcn Design Token System + Base Component Library Summary

Wired one documented light/dark design-token system (AUTH-06) via Tailwind v4 CSS variables matching 01-UI-SPEC.md's exact color/spacing/typography values, shipped a next-themes-free Vite-native ThemeProvider with persistence tests, and vendored all 13 base shadcn components (14 files, including the registry's current `field` replacement for the deprecated `form`) into `src/shared/ui/` for later phases to compose.

## What Was Built

**Task 1 — shadcn init + Tailwind v4 token layer (light + dark), Inter font**
Ran `npx shadcn@latest init` (template `vite`, base `radix`, css-variables on, Nova preset) which wrote `components.json`, `src/lib/utils.ts` (`cn()` via clsx + tailwind-merge), and a default token scaffold into `src/index.css`. Read the generated variable names first (per 01-RESEARCH.md Open Question #2), then replaced every color value under `:root`/`.dark` with 01-UI-SPEC.md's exact hex tokens: background/foreground (white/slate-950 ↔ slate-950/slate-50), card+secondary+popover (slate-100/slate-900), primary (blue-600/blue-500, D-03) driving both the CTA color and the focus `--ring`, destructive (red-600/red-500), border/input (slate-200/slate-800), and the downstream Success (green-600/500) and Warning (amber-600/500) tokens for Phases 2/4/6. Added the spacing scale (`--spacing-xs` 4px through `--spacing-3xl` 64px) plus the D-04 dense-row (`--spacing-row-x` 12px) and touch-target (`--spacing-touch` 44px) exceptions, and the 4-size/2-weight typography scale (`--text-label/body/heading/display`, each paired with its required line-height) as Tailwind v4 `@theme` tokens — these auto-generate `p-xs`, `gap-lg`, `size-touch`, `text-heading` etc. utility classes. Wired `@fontsource-variable/inter` (`Inter Variable`) as `--font-sans`, added a `numeric-cell` utility (`tabular-nums`) for future mileage/DZD table cells, and an `auth-gradient-bg` utility consuming a `--gradient-auth` token for the Stripe-like login/signup background (D-01, consumed in Plan 05).

**Task 2 — Vite-native ThemeProvider + base component library**
Created `src/shared/ui/theme-provider.tsx` as a verbatim implementation of 01-RESEARCH.md's shadcn Vite dark-mode pattern: `theme: 'dark'|'light'|'system'`, `localStorage`-persisted under `wheelio-ui-theme`, toggles `.dark`/`.light` on `document.documentElement`, resolves `'system'` via `prefers-color-scheme`, exports `useTheme()`. Vendored the 13 base components (`button`, `input`, `label`, `card`, `dropdown-menu`, `avatar`, `separator`, `sonner`, `skeleton`, `badge`, `sheet`, `tooltip`, plus `field` — see Deviations for the `form`→`field` substitution) from the shadcn official registry into `src/shared/ui/` via a `components.json` alias rewrite (`ui: "@/shared/ui"`, default is `@/components/ui`). Fixed the vendored `sonner.tsx`'s `next-themes` import to use this repo's own `useTheme()`. Wrote `src/shared/ui/theme-provider.test.tsx` (3 tests, jsdom + real `localStorage`): `setTheme('dark')` adds the `dark` class and persists to `localStorage`; re-mounting (simulated reload) reads the persisted theme back; `setTheme('light')` removes the `dark` class.

## Verification

- `npm run build` — exit 0; `grep -Eq '(^|[^-])\.dark' src/index.css` → `dark-selector-present`.
- `npx vitest run src/shared/ui/theme-provider.test.tsx` — 3/3 passing.
- `npx vitest run --reporter=dot` (full suite) — 3 test files, 11 tests, all passing (8 pre-existing from Plan 01 + 3 new).
- `npx tsc -b --force` — exit 0 (no type errors across `src/`, including all 14 vendored components + theme-provider + its test).
- Manual visual dark/light check (01-UI-SPEC.md AUTH-06 human-check) — deferred to end-of-phase verification per this project's `human_verify_mode: end-of-phase` config; no rendered app screen exists yet to click a theme toggle against (ThemeProvider isn't mounted at the app root until Plan 04's shell work). Colors were confirmed compiled correctly into the build output (`dist/assets/index-*.css` contains the exact `#2563eb` primary hex, etc.).
- Confirmed no `next-themes` import anywhere in the tree (`grep -rln "next-themes" src/` → no matches) and the package is not in `package.json`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] shadcn CLI's style/baseColor init paradigm no longer exists**
- **Found during:** Task 1, running `npx shadcn@latest init` per the plan's literal instruction.
- **Issue:** The installed shadcn CLI is v4.14.0, which replaced the `style: new-york` / `baseColor: slate` init flow 01-RESEARCH.md and 01-UI-SPEC.md were written against with a "preset" system (Nova/Vega/Maia/Lyra/Mira/Luma/Sera/Rhea/Custom) and a `base` flag choosing the component-primitive library (`base`/`radix`/`aria`). Neither `--style` nor `--base-color` flags exist in this CLI generation.
- **Fix:** Ran init with `--template vite --base radix` (matches 01-UI-SPEC.md's Radix UI requirement) and the `nova` preset (uses `lucide-react`, our already-locked icon library), per the plan's own fallback instruction ("read the generated variable names... do not guess them"). The generated CSS variable *names* (`--background`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--card`, `--popover`) matched the shadcn convention the plan expected, so every 01-UI-SPEC.md token was mapped onto them exactly as planned — only the CLI invocation differed, not the resulting architecture.
- **Files modified:** `components.json`, `src/index.css`.
- **Commit:** 62aa0ef

**2. [Rule 1 - Bug] Vendored components landed in the wrong folder + wrong font + banned dependency**
- **Found during:** Task 1/2, inspecting the CLI's default output.
- **Issue:** (a) Default `components.json` aliases point `ui` at `@/components/ui`, not this project's documented `src/shared/ui/` (01-RESEARCH.md project structure). (b) The CLI's Nova preset defaults to the Geist font (`@fontsource-variable/geist`), not Inter. (c) The vendored `sonner.tsx` template imports `next-themes` for toast theme sync — explicitly prohibited by this plan.
- **Fix:** (a) Rewrote `components.json`'s `aliases.ui` to `@/shared/ui` (and `aliases.components` to `@/shared`) before vendoring any component, so every `shadcn add` call wrote directly to the correct location. (b) Uninstalled `@fontsource-variable/geist`, rewired `src/index.css`'s `--font-sans` to the already-installed `@fontsource-variable/inter`. (c) Edited `sonner.tsx`'s import from `next-themes` to `@/shared/ui/theme-provider`'s `useTheme()` (same `{ theme, setTheme }` shape) and uninstalled `next-themes`.
- **Files modified:** `components.json`, `src/index.css`, `package.json`, `package-lock.json`, `src/shared/ui/sonner.tsx`.
- **Commits:** 62aa0ef (font/alias), e5db9e8 (sonner.tsx fix)

**3. [Rule 1 - Bug] `form` registry component is a deprecated empty stub in this CLI generation**
- **Found during:** Task 2, running `npx shadcn add form` — completed with no output and created no file.
- **Issue:** `npx shadcn view form` confirmed the registry entry exists as metadata only (`"type": "registry:ui"`, no `files` array) — the classic react-hook-form-wrapping `Form`/`FormField`/`FormItem`/`FormControl`/`FormMessage` API has been retired from the official registry in favor of a new framework-agnostic `field.tsx` (`Field`/`FieldLabel`/`FieldDescription`/`FieldError`/`FieldGroup`/`FieldSet`/`FieldSeparator`), confirmed via `npx shadcn view field`.
- **Fix:** Vendored `field.tsx` instead of `form.tsx` — same official registry, same form-composition capability, just the current upstream component name. Plan 03 (auth core, login/signup forms) will compose `Field`/`FieldError` with React Hook Form's `fieldState.errors` directly rather than the old `FormField` render-prop pattern.
- **Files modified:** `src/shared/ui/field.tsx` (created; `form.tsx` does not exist).
- **Commit:** e5db9e8

**4. [Rule 3 - Blocking issue] Node 22+ experimental global `localStorage` breaks any test that touches it**
- **Found during:** Task 2, running the plan's own mandated `npx vitest run src/shared/ui/theme-provider.test.tsx` verification — failed with `TypeError: Cannot read properties of undefined (reading 'clear')`.
- **Issue:** This environment's Node 26 ships an experimental global `localStorage`/`sessionStorage` (enabled by default, confirmed via `node --v8-options | grep webstorage` showing `--no-experimental-webstorage` as the opt-out flag). This inert global (its getter returns `undefined` without a `--localstorage-file`) shadows jsdom's own `window.localStorage` implementation inside Vitest's worker processes — even `window.localStorage` itself resolved to `undefined`, not just the bare identifier.
- **Fix:** Added `execArgv: ["--no-experimental-webstorage"]` to `vitest.config.ts`'s top-level `test` config (Vitest 4 moved `execArgv` out of the removed `poolOptions.forks`/`poolOptions.threads` nesting to a top-level option). Verified via a throwaway probe test that this restores jsdom's real `Storage` implementation, then confirmed the fix against the actual theme-provider test.
- **Files modified:** `vitest.config.ts`.
- **Commit:** e5db9e8
- **Why this matters beyond this plan:** any later phase test that reads/writes `localStorage` (e.g. Plan 03's auth store persisting the refresh token per 01-RESEARCH.md Pattern 4) would have hit this exact failure. Fixing it here in the test-infra config unblocks all of them.

No architectural deviations (Rule 4) were needed — every item above was either a tooling-version adaptation explicitly anticipated by the plan's own "read the generated file, don't guess" instruction, a same-registry component-name substitution, or an environment/test-infra bug fix required for this plan's own verification to pass.

## Known Stubs

None. Every file this plan produces is either a fully-wired token definition or a directly-usable vendored component; nothing renders a placeholder value.

## Threat Flags

None beyond what 01-02-PLAN.md's own threat model already covers (T-01-SC: official-registry-only vendoring, satisfied — every component came from `ui.shadcn.com`'s official registry, no third-party registry was configured; T-01-theme: localStorage theme preference, accepted risk, unchanged).

## Self-Check: PASSED
