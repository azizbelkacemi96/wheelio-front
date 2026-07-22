# Stack Research

**Domain:** Professional SaaS fleet-management dashboard (Wheelio Front) — pure SPA consuming an existing Go REST API, responsive desktop+mobile, FR/EN i18n, no SEO
**Researched:** 2026-07-22
**Confidence:** HIGH (framework/tooling choices, verified live against npm registry) / MEDIUM (qualitative comparisons, cross-checked across multiple 2026 sources) / explicitly flagged where the API's actual contract forces a non-ideal tradeoff (JWT storage)

## Recommendation Summary (opinionated, not a menu)

**Build a pure client-side SPA: Vite + React 19 + TypeScript, TanStack Router + TanStack Query, shadcn/ui on Tailwind CSS v4, React Hook Form + Zod, i18next, Zustand for the few bits of client-only UI state.** No SSR/SSG. Rationale for the SSR call is broken out below since it's the single biggest architectural decision and downstream from it (routing, data-fetching, deployment) everything else follows.

## SSR/SSG vs SPA — the call

**Verdict: pure client-side SPA (Vite build → static assets on any CDN/static host). No Next.js, no Remix, no server rendering.**

Every requirement that normally pushes a team toward a meta-framework (Next.js/Remix/Astro) is explicitly absent here:
- **No SEO** — the app sits entirely behind JWT auth; Google (or any crawler) will never see a single route. SSR/SSG's entire value proposition is invisible to an authenticated-only product.
- **No public marketing pages in v1** — confirmed out of scope in PROJECT.md. There is no landing page that would benefit from static generation.
- **No need for server-side API routes** — wheelio-api already is the backend; introducing a Next.js server layer would mean maintaining a second server for zero functional gain, and would directly violate the project's "purely a frontend" framing.
- **First-load performance for an internal/authenticated tool matters far less than for a public marketing site** — users log in once per shift and stay in the app; a client-rendered app shell + code-split routes is fast enough, and the field-usage requirement (mobile/tablet at the vehicle) is served by a small, well cached JS bundle, not by SSR.

Adding a meta-framework here would only add operational surface (a Node server to deploy/monitor, hydration bugs, RSC/client-component boundary complexity) with no offsetting benefit. This is confirmed by the 2025-2026 industry consensus: internal dashboards and admin panels behind a login are the textbook case for Vite + React SPA over Next.js. Confidence: HIGH.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|------------------|
| React | 19.2.8 | UI library | Industry-standard, largest ecosystem, what shadcn/ui and TanStack libraries target first. Confidence: HIGH (npm registry, verified live). |
| Vite | 8.1.5 | Build tool / dev server | Near-instant HMR, ESM-native, zero-config TS/JSX, produces a lean static build for any host. The correct tool layer once Next.js is ruled out. Confidence: HIGH. |
| TypeScript | 7.0.2 | Language | Non-negotiable for a CRUD-heavy, role/permission-driven dashboard consuming a typed Go API — catches DTO/shape drift at compile time instead of in the field. Use `strict: true`. Confidence: HIGH. |
| TanStack Router | 1.170.18 | Client-side routing | Fully-typed route params, search-params, and loaders with zero codegen — explicitly the recommended router for "client-heavy SPAs, dashboards, admin panels, internal tools" in 2026 comparisons. Confidence: MEDIUM (qualitative, cross-checked across sources). |
| TanStack Query | 5.101.4 | Server-state management | Owns every piece of data that comes from wheelio-api: caching, background refetch, invalidation after mutations (create vehicle, close contract, etc.), request de-duplication. This is the 2026 consensus default for "server state," no exceptions. Confidence: HIGH. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Tailwind CSS | 4.3.3 | Utility-first styling | Foundation for shadcn/ui; v4's CSS-native config (no `tailwind.config.js` needed for most cases) simplifies the from-scratch visual identity work this project requires. |
| shadcn/ui | latest (copy-in, not a pinned npm version — components are vendored into the repo via the CLI) | Component system | Copy-paste-owned components on Radix + Tailwind. The 2024-2026 default for teams that need full design control and will be judged on visual polish — directly matches "this frontend IS the sales pitch." Prefer this over Mantine/Ant Design, which are faster to scaffold but lock you into their own visual language, working against the "define a modern SaaS identity" requirement. |
| React Hook Form | 7.82.0 | Form state | Smallest bundle of any feature-complete form library, uncontrolled by default (no re-render per keystroke — matters for the inspection form with many per-zone damage fields), first-class Zod integration via `@hookform/resolvers`. |
| Zod | 4.4.3 | Schema validation | Validates all form input and can double as the shape-check for API responses at integration boundaries. Pairs directly with React Hook Form's resolver. |
| Zustand | 5.0.14 | Client-only UI state | For state that is *not* server data: active sidebar/nav state, selected role view, wizard step in the inspection flow, current locale toggle UI. Keep this deliberately small — TanStack Query already owns all server state; do not duplicate API data into Zustand. |
| i18next + react-i18next | i18next 26.3.6 / react-i18next 17.0.10 | i18n (FR default, EN day one) | Largest ecosystem/most mature React i18n solution; supports namespace lazy-loading (load only the translations needed per route — relevant since the app will grow past the core v1 flow), interpolation, and pluralization out of the box. Configure with FR as the default/fallback locale per PROJECT.md. |
| Playwright | @playwright/test 1.61.1 | E2E testing | 3-5 critical flows: login, vehicle→customer→contract→inspection→invoice PDF happy path, and the photo-capture flow on a mobile viewport. |
| Vitest | 4.1.10 | Unit/component testing | Shares Vite's config and transform pipeline (no separate Babel/ts-jest setup), ESM-native, materially faster than Jest for this stack. |
| @testing-library/react + jest-dom + user-event | latest (bundled together) | Component testing | User-centric assertions for CRUD forms, role-based nav rendering, and the inspection photo flow. |
| MSW (Mock Service Worker) | latest | API mocking in tests | Mocks the wheelio-api REST contract in both unit and integration tests without touching a real backend. |
| ky (or native `fetch` wrapper) | ky 2.0.2, if not hand-rolling `fetch` | HTTP client | See "Axios vs fetch vs ky" note below — thin wrapper over native fetch preferred over Axios. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| ESLint (flat config) + typescript-eslint | Linting | Standard for a TS/React/Vite 2025-2026 project; pair with `eslint-plugin-react-hooks` and `eslint-plugin-jsx-a11y` (accessibility matters for a professional SaaS product). |
| Prettier | Formatting | Keep it boring and automatic; run on pre-commit. |
| shadcn CLI (`npx shadcn@latest add ...`) | Component scaffolding | Vendors component source into `src/components/ui`, not a locked npm dependency — you own and can restyle every component to match the custom visual identity. |

## Installation

```bash
# Scaffold
npm create vite@latest wheelio-front -- --template react-ts

# Core
npm install react@19 react-dom@19
npm install @tanstack/react-router @tanstack/react-query
npm install react-hook-form zod @hookform/resolvers
npm install zustand
npm install i18next react-i18next i18next-browser-languagedetector

# Styling (Tailwind v4 + shadcn/ui)
npm install tailwindcss @tailwindcss/vite
npx shadcn@latest init

# HTTP client (only if not hand-rolling a thin fetch wrapper)
npm install ky

# Dev dependencies
npm install -D typescript vitest @vitejs/plugin-react
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
npm install -D @playwright/test
npm install -D msw
npm install -D eslint typescript-eslint eslint-plugin-react-hooks eslint-plugin-jsx-a11y prettier
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Vite + React SPA | Next.js (App Router) | Only if a public marketing/pricing site or self-signup flow gets added later — explicitly out of scope for this milestone. Revisit if "Out of Scope: site vitrine public" is reversed. |
| TanStack Router | React Router v7 | If the team wants the larger ecosystem/lowest migration risk and is willing to run it in "framework mode" (adds an SSR server) to get its full type-safety benefit — not worth it for a pure SPA. Plain SPA-mode React Router v7 loses most of its v7 advantage over v6, so it isn't a strong contender here either way. |
| shadcn/ui | Mantine | If the team needs to ship data-table/date-range-heavy screens fast with less custom styling effort and is willing to inherit Mantine's visual language rather than build a bespoke one. Given "this frontend IS the sales pitch," this tradeoff cuts against the project's stated goal. |
| React Hook Form | TanStack Form | Only if going all-in on the TanStack ecosystem (Router+Query+Form) for one unified mental model — the inspection form's field count doesn't need TanStack Form's extra type-safety machinery, and its API is still less battle-tested. |
| Zustand | Redux Toolkit | Only if the team scales to a size that needs strict Redux conventions and time-travel debugging across many contributors — not justified for a small, focused v1 team. |
| i18next/react-i18next | react-intl or Lingui | react-intl if translators require strict ICU MessageFormat compliance for a translation platform; Lingui if bundle size becomes a measured problem (its ~3KB vs i18next's ~8KB) — neither concern is present at this project's stage. |
| `<input capture>` for photo capture | `getUserMedia()` custom camera UI (e.g. react-webcam) | Only if you need in-app live preview / multi-shot-before-upload UX. Avoid as the default: `getUserMedia()` is blocked on non-Safari iOS browsers (Chrome/Firefox on iOS are WebKit-restricted), a real risk for a field team using whatever phone/tablet is at hand. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| Next.js / Remix / any SSR meta-framework | Solves problems (SEO, first-paint for anonymous visitors, server API routes) this project explicitly does not have; adds a server to operate and hydration complexity for zero payoff. | Vite + React SPA |
| Create React App | Deprecated / unmaintained tooling as of 2025-2026, no active development. | Vite |
| Redux (classic, without Toolkit) | Legacy boilerplate-heavy pattern superseded by Redux Toolkit years ago; and Redux Toolkit itself is not needed here. | Zustand (or Redux Toolkit only if team scale demands it) |
| Moment.js | Long-deprecated, large bundle, mutable API — actively discouraged upstream. | `date-fns` or native `Intl`/`Temporal`-adjacent utilities, especially relevant since dates need FR/EN locale formatting. |
| Axios as a default choice with no justification | Heavier than needed; native `fetch` (or a 1-2KB wrapper) is sufficient for a REST client hitting a single known API, and avoids an extra abstraction layer over something the platform already provides. | native `fetch` wrapped in a small typed API client, or `ky` if interceptor-like retry/hooks ergonomics are wanted. |
| Storing JWT access AND refresh tokens in `localStorage` unexamined | Full localStorage persistence of both tokens is the most XSS-exposed pattern and is explicitly discouraged by 2026 guidance. | See the JWT storage note below — the ideal (httpOnly cookie) is blocked by the current API contract, so this project uses the best available compromise, not the naive worst one. |
| Client-side PDF rendering libraries (pdf.js, react-pdf) | Unnecessary — wheelio-api streams finished `application/pdf` bytes directly; the frontend's job is only to trigger/stream a download, not render or manipulate PDF content. | `fetch` + `blob()` + `URL.createObjectURL` + a synthetic `<a download>` click (see Architecture note below). |

## Stack Patterns by Variant

**JWT token storage (constrained by the existing API contract — read this before implementing auth):**
The textbook 2026 best practice for SPA JWT auth is: access token in memory, refresh token in an httpOnly/Secure/SameSite cookie set by the server (or a full BFF token vault), per OAuth's Security Best Current Practice (RFC 9700). **This is not available as-is**: `wheelio-api`'s `/auth/login`, `/auth/signup`, and `/auth/refresh` all return both the access token and the refresh token as plain JSON body fields (verified directly in `internal/adapter/httpapi/auth_handler.go` — no `Set-Cookie` involved), and backend changes are explicitly out of scope for this milestone.
- Use: access token held in memory only (e.g. inside the TanStack Query client's auth context or a small Zustand store), never written to `localStorage`.
- Use: refresh token in `localStorage` as the only practical way to persist a session across a page reload/tab close given the current API shape. Mitigate with: short refresh-token TTL, single active-session-per-device semantics if the API supports revocation, a strict Content-Security-Policy blocking third-party script injection, and no dependence on inline scripts.
- Flag for later: if there's ever appetite for a small backend change, moving to an httpOnly refresh cookie set by `wheelio-api` would meaningfully raise the XSS bar. Confidence: MEDIUM (this is an explicit constrained compromise, not a first-choice recommendation — flagged for the roadmap as a security tradeoff to revisit, not silently accepted).

**Damage-inspection photo capture (mobile/tablet, on-site):**
Use `<input type="file" accept="image/*" capture="environment">` as the primary capture mechanism — it opens the rear camera directly on mobile, degrades gracefully to a normal file picker on desktop (where the state-of-the-lieux flow may also start), and needs no extra permission prompts or library weight. Upload via the same `multipart/form-data` pattern the API already uses for document uploads (confirmed present in `internal/adapter/httpapi/document_handler.go`) — no new upload paradigm needs to be invented on the frontend. Do not reach for `getUserMedia()`/custom camera-preview libraries as the default; they're blocked on non-Safari iOS browsers and add complexity the field flow doesn't need for v1.

**PDF download (invoice, contract, état des lieux):**
The API streams `application/pdf` bytes directly and is never cached. On the frontend: `fetch()` the endpoint with the `Authorization: Bearer <token>` header (a plain `<a href>` cannot carry custom headers), read `response.blob()`, `URL.createObjectURL(blob)`, inject a temporary `<a download="...">` and `.click()` it, then `URL.revokeObjectURL()`. No client-side PDF rendering library needed — this is a "trigger a download," not a "render a PDF," problem.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| React 19.2.x | Vite 8.x + `@vitejs/plugin-react` | Standard, no known incompatibilities as of this research. |
| Tailwind CSS 4.x | shadcn/ui | shadcn/ui's current generation targets Tailwind v4's CSS-first config; use the shadcn CLI's own init flow rather than hand-wiring v3-era config. |
| Zod 4.x | React Hook Form 7.x via `@hookform/resolvers` | Confirm the installed `@hookform/resolvers` version explicitly supports Zod v4's schema API (v4 changed some internals vs v3) at implementation time. |
| TanStack Router 1.x | TanStack Query 5.x | Designed to be used together (shared maintainers, compatible data-loading patterns); no known conflicts. |

## Sources

- npm registry (`registry.npmjs.org`) — live version lookups for react, react-dom, vite, typescript, @tanstack/react-query, @tanstack/react-router, react-router-dom, react-hook-form, zod, tailwindcss, i18next, react-i18next, zustand, vitest, @playwright/test, axios, ky. Confidence: HIGH (primary source, fetched directly during this research).
- WebSearch, multiple independent 2025-2026 comparison articles cross-checked per topic (Vite vs Next.js, TanStack Router vs React Router v7, shadcn/ui vs Mantine, React Hook Form vs TanStack Form, i18next vs react-intl vs Lingui, JWT storage patterns, PDF blob download pattern, Zustand vs Redux vs Jotai, Vitest/Playwright testing stack, mobile camera capture). Confidence: MEDIUM (qualitative synthesis, not a single authoritative doc, but consistent across independently-authored sources).
- `wheelio-api` source (`internal/adapter/httpapi/auth_handler.go`, `internal/adapter/httpapi/document_handler.go`) — read directly to verify the actual auth response shape (JSON tokens, no cookies) and the existing multipart upload pattern the frontend should mirror. Confidence: HIGH (primary source, the API this frontend must integrate with).

---
*Stack research for: Wheelio Front (SaaS fleet-management dashboard, Algeria car rental)*
*Researched: 2026-07-22*
