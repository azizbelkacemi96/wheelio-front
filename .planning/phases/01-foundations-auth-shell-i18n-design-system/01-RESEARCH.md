# Phase 1: Foundations — Auth, Shell, i18n, Design System - Research

**Researched:** 2026-07-22
**Domain:** JWT SPA auth (single-flight refresh), role-aware routing shell (TanStack Router), i18n architecture (FR-default/EN), Tailwind v4 + shadcn/ui design-token system with light/dark
**Confidence:** HIGH (API contract — read directly from source; package registry — verified live) / MEDIUM (community patterns for TanStack Router auth, ky refresh interceptor, cross-checked across multiple sources) / LOW where flagged `[ASSUMED]`

## Summary

This phase has no feature-screen complexity — its entire risk is in four infrastructure decisions that every later phase depends on and that are expensive to retrofit: (1) the JWT refresh interceptor, (2) the permission model, (3) the i18n plural/formatting discipline, and (4) the design-token wiring. All four are now grounded in the actual `wheelio-api` source, not assumption.

The single most important concrete finding from re-reading the API source this pass: **the frontend cannot decode the access token for role/scope information — the JWT carries only `sub` (user ID) and `org` (org ID), nothing else.** `Scope` (the `CanRead`/`CanOperate`/`CanManage`/`IsOrgAdmin` object) is computed server-side, fresh, on every request from a DB lookup (`ResolveScope`) — it is never embedded in the token and there is no dedicated `/scope` endpoint. The only way the frontend obtains role/permission data is `GET /me`, which returns `{ user: { org_role, ... }, organization, memberships: [{ agency_id, role }] }`. `permissions.ts` must be built by porting the exact Go logic in `internal/domain/identity/scope.go` (`RoleInAgency`, `CanRead`, `CanOperate`, `CanManage`, `HasOrgRole`, agency-role rank `viewer(1) < agent(2) < manager(3)`) into TypeScript, fed by this `/me` shape — not by inventing a simpler client-side model.

Second finding: the owner's agency switcher (D-10/D-11) needs **no new API call and no scope re-fetch on switch**. Because `Scope.RoleInAgency` returns `AgencyRoleManager` unconditionally for any org admin (owner/admin) regardless of which agency ID is queried, switching agencies is a pure client-side state change (`currentAgencyId` in a Zustand store) that only changes which `agency_id` query param later feature-phase requests use — it does not need to re-authenticate or reload permissions. The switcher's data source is `GET /agencies` (already scoped by the RLS `org_id` GUC).

Third: access-token TTL is confirmed **15 minutes** (`ACCESS_TOKEN_TTL` env default), refresh-token TTL **720h/30 days**, and refresh is **rotating with theft detection** (reusing an already-rotated refresh token revokes every session for that user). This makes the single-flight refresh queue non-negotiable — any naive per-request refresh-on-401 will race, the second caller's stale token will look "already used," and the theft-detection logic will silently log the whole session out.

**Primary recommendation:** Build the API client (`shared/api/client.ts`, ky-based) with a single shared in-flight refresh promise and a request queue before writing a single feature screen; build `permissions.ts` as a literal TypeScript port of `scope.go`; use i18next's built-in v4 CLDR pluralization (via `Intl.PluralRules`) rather than pulling in `i18next-icu`, since French's "0 is singular" rule is already handled correctly by `Intl.PluralRules('fr')` — do not add the ICU plugin unless a later phase genuinely needs nested/gendered ICU `select` syntax.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Login (JWT) + transparent single-flight token refresh | Confirmed `/auth/login` and `/auth/refresh` response shape (`authResponse`: `token_type`, `access_token`, `access_token_expires_at`, `refresh_token`, `user`, `organization`); confirmed 15min access TTL / 30-day rotating refresh; single-flight ky interceptor pattern below |
| AUTH-02 | Session expiry never destroys in-progress work; refresh happens invisibly before any hard redirect | Same interceptor; `access_token_expires_at` from the login/refresh response lets the client proactively refresh slightly before expiry instead of waiting for a 401 (belt-and-suspenders with the reactive 401 path) |
| AUTH-03 | Nav/actions reflect role via `/me` scope, never re-derived independently | `GET /me` shape confirmed (`meResponse`); `permissions.ts` TypeScript port of `scope.go` below; TanStack Router `beforeLoad`/route context pattern for gating |
| AUTH-04 | Owner can switch agencies | `GET /agencies` confirmed as the data source; confirmed no re-auth/scope-refetch needed on switch (org admins are implicit manager everywhere) |
| AUTH-05 | FR (default) / EN, switchable | i18next + react-i18next setup, CLDR `Intl.PluralRules`-based pluralization (built-in, no extra package needed for the specific "0 véhicule" pitfall) |
| AUTH-06 | Documented design-token system + base component library | shadcn/ui official Vite dark-mode pattern (CSS variables + class-based `ThemeProvider`, no Next.js-specific package), token values from UI-SPEC.md |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Identité visuelle**
- **D-01:** Style reference is Stripe — colorful/gradient-friendly, "confident fintech" feel, not the neutral Linear/Notion look.
- **D-02:** Dark mode ships in v1, alongside light — both themes designed from the start via the design-token system, not retrofitted.
- **D-03:** Primary/accent color is blue (trust, standard for SaaS/automotive).
- **D-04:** UI density is dense/compact — favor more rows visible per screen (vehicle/contract tables) over generous whitespace; matches a front-desk agent working quickly at the counter.

**Connexion & session**
- **D-05:** No password-reset flow in v1. The backend (`wheelio-api`) has zero reset-password endpoint (`/auth/signup`, `/login`, `/refresh`, `/logout` only) — building a real reset flow would require backend work that's out of scope for this project. Do not add even a fake/contact-link placeholder; simply omit it.
- **D-06:** Login errors are generic ("email ou mot de passe incorrect") for any failure — mirrors the backend's existing timing-equalizer anti-enumeration protection; never distinguish "unknown email" from "wrong password" client-side.
- **D-07:** A signup screen IS included in the front (not just an API curl call) — but it is a plain in-app screen, not a public marketing/self-serve site. This does not reopen the earlier "no self-serve signup" decision (PROJECT.md Out of Scope) — that exclusion was about a public-facing marketing/pricing site with self-serve onboarding; this is just a convenience screen for account creation, reachable like the login screen, not advertised.

**Navigation par rôle**
- **D-08:** The base navigation (Aujourd'hui, Véhicules, Clients, Contrats, États des lieux) is identical for all three roles (agent/gérant/owner) — no role-based hiding within this base set. Fine-grained action permissions (create/edit/delete on specific records) are still gated per-action via the shared permission utility, independent of this nav-level decision.
- **D-09:** Three admin nav sections are owner-only and fully hidden (not just disabled) for agent/gérant: **Identité fiscale société**, **Gestion agences**, **Facturation transverse** (all-agency invoice view). This is a nav-section-visibility decision, distinct from D-08's per-action gating.

**Switch agence (owner)**
- **D-10:** Agency switcher is a persistent top-bar dropdown (Slack/Linear-style) — always visible, one click, no dedicated page.
- **D-11:** Switching agency keeps the owner on their current section (e.g., staying on "Contrats" but now showing the newly selected agency's contracts) — never force a return to the dashboard/"Aujourd'hui" view on switch.

### Claude's Discretion
None flagged this round — every gray area surfaced had a concrete user decision.

### Deferred Ideas (OUT OF SCOPE)
- **Password reset (self-service) flow** — requires a new backend endpoint on `wheelio-api` (out of scope for this frontend-only project). Revisit later as a backend-touching initiative, not a v1.x frontend phase.
</user_constraints>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Login / signup form + validation | Browser / Client | — | Pure client-rendered form (React Hook Form + Zod), no SSR |
| JWT storage & refresh orchestration | Browser / Client | API / Backend (issues/rotates tokens) | Access token in-memory JS, refresh token in `localStorage`; all rotation logic lives in the API client module, but the actual token issuance/rotation/theft-detection is backend-owned (`wheelio-api` `Refresh`/`RevokeAllForUser`) |
| Role/permission resolution (`Scope`) | API / Backend | Browser / Client (mirrors read-only) | Backend (`ResolveScope`) is the sole authority; frontend's `permissions.ts` is a *read-only mirror* for UX only, never a security boundary |
| Route guarding / nav visibility | Browser / Client | — | TanStack Router `beforeLoad` + `permissions.ts`; purely a UX concern, backend still re-validates every mutating call |
| Agency-switcher state | Browser / Client | — | Client-only UI state (Zustand); no server round-trip needed to switch since org admins are implicit manager everywhere |
| i18n resource resolution / locale switch | Browser / Client | — | i18next resources bundled/lazy-loaded client-side; no server-rendered locale negotiation (pure SPA) |
| Design tokens (colors/spacing/typography) | Browser / Client | CDN / Static (font asset) | CSS variables + Tailwind v4 theme, compiled into the static build; font file served from CDN or self-hosted static asset |
| Session bootstrap (`/me` on load) | Browser / Client | API / Backend | Client calls `/me` once refresh succeeds; backend is the data source, client owns *when* to call it (app boot, after login, after refresh) |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ky | 2.0.2 | HTTP client with hookable request/response lifecycle | Already locked in STACK.md; its `hooks.afterResponse` (not `beforeRetry`, which only fires on ky's own retry option) is the correct extension point for a manual "retry once after refresh" flow [CITED: ky GitHub discussions #381, #538] |
| @tanstack/react-router | 1.170.18 | Typed routing, `beforeLoad` guards, router `context` | `beforeLoad` is the documented mechanism for auth guards — throws `redirect({ to: '/login' })` before the route (and all its children) load [CITED: tanstack.com/router/latest/docs/guide/authenticated-routes] |
| zustand | 5.0.14 | Auth store (access token in memory, refresh token persisted), agency-switcher state, theme/locale UI prefs | `persist` middleware's `partialize` option lets only the refresh token (never the access token) survive to `localStorage` [CITED: zustand.docs.pmnd.rs/reference/middlewares/persist] |
| i18next + react-i18next | 26.3.6 / 17.0.10 | i18n runtime | Built-in v4 pluralization is `Intl.PluralRules`-backed since i18next v21+ (mandatory since v24) — correctly resolves French's `one` category for count 0 *and* 1 without any extra plugin [CITED: i18next.com/translation-function/plurals] |
| tailwindcss | 4.3.3 | Utility CSS / token compilation | Already locked in STACK.md |
| shadcn/ui (vendored, no pinned version) | — | Component system, `new-york` style / `slate` base per UI-SPEC | Already locked; Vite-specific dark-mode guide (custom `ThemeProvider`, no Next-only package) confirmed at `ui.shadcn.com/docs/dark-mode/vite` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| class-variance-authority | 0.7.1 | Variant-driven component styling (shadcn dependency) | Auto-installed by `npx shadcn add <component>`; do not hand-roll variant switch logic |
| tailwind-merge | 3.6.0 | Resolve conflicting Tailwind classes when composing `cn()` | shadcn's own `lib/utils.ts` `cn` helper wraps this + `clsx` |
| clsx | 2.1.1 | Conditional class-name composition | Paired with `tailwind-merge` inside `cn()` |
| @fontsource-variable/inter (or Google Fonts `<link>`) | 5.3.0 | Self-hosted Inter variable font | Per UI-SPEC.md; either self-host via this package or link to Google Fonts CDN — no material difference for this SPA (see Alternatives) |
| i18next-browser-languagedetector | (already in STACK.md) | Detect browser locale as an initial hint | Still only a *hint* — FR remains the hard default per AUTH-05/PROJECT.md when no explicit user choice is stored |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Built-in i18next v4 plurals (`Intl.PluralRules`) | `i18next-icu` plugin | Only needed for full ICU `select`/nested-gender syntax (e.g. "inscrit"/"inscrite"); adds a dependency and changes interpolation syntax (single braces) app-wide. For this phase's scope (nav labels, empty-state copy, error copy — no gendered strings yet per UI-SPEC.md Copywriting Contract), the built-in plural suffixes (`key_one`/`key_other`) are sufficient and simpler. Revisit if a later phase introduces gendered French copy (e.g. "Client inscrit(e)"). |
| Custom Vite-native `ThemeProvider` (shadcn's own doc pattern) | `next-themes` npm package | `next-themes` works outside Next.js too, but is branded/documented for Next; shadcn's own Vite dark-mode guide ships a ~40-line custom provider with zero extra dependency — simpler and it's the pattern shadcn itself documents for this exact stack. |
| Self-hosted `@fontsource-variable/inter` | Google Fonts `<link>` tag | Google Fonts is zero-install and one line in `index.html`, but adds a third-party network request per page load (privacy/GDPR consideration, minor for an internal-tool SPA) and a render-blocking font-load risk. Self-hosting via the fontsource package bundles the font into the Vite build (no external request, consistent with an offline-tolerant field-usage tool) — prefer self-hosting given the mobile/field-usage requirement in later phases. |
| ky's `hooks.afterResponse` + manual shared promise | Axios interceptors | STACK.md already ruled out Axios as unjustified extra weight; ky's hook system supports the same pattern with less API surface. |

**Installation:**
```bash
# Scaffold (Vite + React 19 + TS)
npm create vite@latest wheelio-front -- --template react-ts

# Core
npm install react@19 react-dom@19
npm install @tanstack/react-router @tanstack/react-query
npm install zustand
npm install i18next react-i18next i18next-browser-languagedetector
npm install ky

# Styling (Tailwind v4 + shadcn/ui)
npm install tailwindcss @tailwindcss/vite
npx shadcn@latest init
npx shadcn@latest add button input label form card dropdown-menu avatar separator sonner skeleton badge sheet tooltip

# Fonts
npm install @fontsource-variable/inter

# Forms/validation (used by login/signup this phase)
npm install react-hook-form zod @hookform/resolvers
```

**Version verification:** All packages above were checked live against the npm registry on 2026-07-22 (see Package Legitimacy Audit). Versions match what STACK.md already recorded at project-research time; no drift detected.

## Package Legitimacy Audit

| Package | Registry | Age (latest publish) | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|----------------------|--------------|-------------|---------|-------------|
| react / react-dom | npm | 2026-07-21 (routine release) | 159M / 150M | github.com/react/react | SUS ("too-new") | **Approved** — flag is a false positive: the heuristic checks latest-version publish recency, not package novelty. 150M+/week downloads + canonical repo = unambiguous. Already `[VERIFIED: npm registry]` in project STACK.md. |
| vite | npm | 2026-07-16 (routine release) | 157M | github.com/vitejs/vite | SUS ("too-new") | **Approved** — same false-positive pattern as above. |
| typescript | npm | 2026-07-08 (routine release) | 240M | github.com/microsoft/TypeScript | SUS ("too-new") | **Approved** — same. |
| @tanstack/react-router / react-query | npm | 2026-07-13 / 2026-07-21 (routine releases) | 22M / 60M | github.com/TanStack/router, /query | SUS ("too-new") | **Approved** — same. |
| tailwindcss | npm | 2026-07-16 (routine release) | 113M | github.com/tailwindlabs/tailwindcss | SUS ("too-new") | **Approved** — same. |
| react-hook-form | npm | 2026-07-18 (routine release) | 57M | github.com/react-hook-form/react-hook-form | SUS ("too-new") | **Approved** — same. |
| i18next / react-i18next | npm | 2026-07-09 / 2026-07-15 (routine releases) | 20M / 14M | github.com/i18next/i18next, /react-i18next | SUS ("too-new") | **Approved** — same. |
| lucide-react | npm | 2026-07-17 (routine release) | 95M | github.com/lucide-icons/lucide | SUS ("too-new") | **Approved** — same. |
| zod, zustand, ky, @hookform/resolvers, i18next-browser-languagedetector | npm | various, established | 45M-234M | verified repos | OK | Approved |
| class-variance-authority, tailwind-merge, clsx | npm | established | 58M / 75M / 112M | verified repos | OK | Approved (shadcn's own vendored dependencies) |
| @fontsource-variable/inter | npm | 2026-07-19 (routine release) | 2.4M | github.com/fontsource/font-files (fontsource monorepo) | SUS ("too-new") | **Approved with note** — 2.4M weekly downloads confirms an established, actively-maintained font-packaging project; the SUS flag is the same recency-heuristic false positive. If a stricter reading of the gate is preferred, gate behind `checkpoint:human-verify` before install, or use the Google Fonts `<link>` alternative to sidestep npm entirely. |
| i18next-icu | npm | 2026-06-30 (routine release) | 408K | github.com/i18next/i18next-icu | SUS ("too-new") | **Not recommended for this phase** (see Alternatives) — not installed. If a later phase needs full ICU `select`/gender syntax, re-run this gate at that time and add a `checkpoint:human-verify` task before installing. |
| next-themes | npm | 2025-03-11 | 25M | github.com/pacocoursey/next-themes | OK | **Not used** — shadcn's own Vite dark-mode doc recommends a custom provider instead; this package adds no value for a non-Next app. |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** all core framework packages (react, vite, typescript, TanStack Router/Query, tailwindcss, react-hook-form, i18next, react-i18next, lucide-react) plus `@fontsource-variable/inter` — every flag traced to the legitimacy-check tool's "too-new" heuristic firing on a *routine version release* of an extremely high-download, canonical-repo package, not an actual novelty/hallucination signal. `i18next-icu` is the one genuinely-deferred package (not installed this phase). Planner: use judgment on whether to add `checkpoint:human-verify` gates for the core-framework SUS entries — mechanically gating `react`/`vite` itself behind a manual verification step this early is likely unnecessary overhead; the reasoning is documented per-row above for an informed decision either way.

*Package names above were discovered from this project's own prior `STACK.md` (already `[VERIFIED: npm registry]` there) and from official docs (shadcn, i18next, ky, zustand) — cross-checked live against the npm registry again in this pass on 2026-07-22.*

## Architecture Patterns

### System Architecture Diagram

```
[Browser tab loads app]
        |
        v
[main.tsx bootstraps: QueryClientProvider, ThemeProvider, i18nProvider, RouterProvider]
        |
        v
[Auth bootstrap: read persisted refresh token from Zustand/localStorage]
        |
   has refresh token? --no--> [render "/login" route, unauthenticated]
        |yes
        v
[POST /auth/refresh] --fail--> [clear stored refresh token] --> [render "/login"]
        |success (access_token + rotated refresh_token)
        v
[store access_token in-memory only; store new refresh_token (persisted)]
        |
        v
[GET /me] --fail--> [render full-shell error banner + Retry (per UI-SPEC copy)]
        |success ({user, organization, memberships})
        v
[permissions.ts derives Scope-equivalent object from memberships + org_role]
        |
        v
[TanStack Router beforeLoad on "/_authenticated" passes; AppShell mounts]
        |
        +--> [Nav renders: base items always; 3 admin sections only if isOrgAdmin]
        +--> [Agency switcher renders only if isOrgAdmin — lists GET /agencies]
        +--> [User menu: name/role from Scope, logout (no confirm)]
        |
        v
[Every subsequent authenticated request via shared ky client]
        |
        v
[Attach Authorization: Bearer <in-memory access_token>]
        |
   401? --no--> [response returned to caller]
        |yes
        v
[single in-flight refresh promise? --already running--> await it]
        |no running promise
        v
[POST /auth/refresh with stored refresh_token] --fail--> [force logout, redirect /login,
                                                            show "Session expirée" copy]
        |success
        v
[update in-memory access_token + persisted refresh_token; retry original request once]
```

### Recommended Project Structure

```
src/
├── app/
│   ├── router.tsx             # route tree, "_authenticated" layout route with beforeLoad guard
│   ├── providers.tsx           # QueryClientProvider, ThemeProvider, i18n init, RouterProvider
│   └── shell/
│       ├── AppShell.tsx        # single shell, reads scope, renders nav
│       ├── TopBar.tsx          # agency switcher (owner-only), language switch, user menu
│       └── NavRail.tsx         # base nav + conditionally-rendered admin sections
├── features/
│   └── auth/
│       ├── LoginPage.tsx
│       ├── SignupPage.tsx
│       ├── api.ts              # login/signup/logout typed calls
│       └── schemas.ts          # Zod schemas (login/signup)
├── shared/
│   ├── api/
│   │   └── client.ts           # ky instance, single-flight refresh, auth header injection
│   ├── auth/
│   │   ├── store.ts            # Zustand: accessToken (memory), refreshToken (persisted), scope, currentAgencyId
│   │   └── permissions.ts      # TypeScript port of scope.go — single source of truth
│   ├── ui/                     # shadcn components + theme-provider.tsx
│   └── i18n/
│       ├── index.ts            # i18next.init()
│       ├── fr/common.json
│       └── en/common.json
└── types/
    └── identity.ts              # DTOs mirroring meResponse/authResponse exactly
```

### Pattern 1: Single-flight refresh via ky `afterResponse` hook

**What:** One shared `Promise<string>` guards concurrent 401s; every other in-flight request awaits the same promise instead of independently calling `/auth/refresh` (which would race against the API's rotating-refresh theft detection).
**When to use:** Every authenticated request, from the very first feature call onward — this is infrastructure, not optional.
**Example:**
```typescript
// shared/api/client.ts
import ky from "ky";
import { useAuthStore } from "@/shared/auth/store";

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const { refreshToken, setTokens, clearSession } = useAuthStore.getState();
  if (!refreshToken) {
    clearSession();
    throw new Error("no refresh token");
  }
  try {
    const res = await ky
      .post("auth/refresh", { json: { refresh_token: refreshToken }, prefixUrl: import.meta.env.VITE_API_URL })
      .json<{ access_token: string; refresh_token: string; access_token_expires_at: string }>();
    setTokens({ accessToken: res.access_token, refreshToken: res.refresh_token, expiresAt: res.access_token_expires_at });
    return res.access_token;
  } catch (e) {
    clearSession(); // refresh itself failed — this is the one case allowed to redirect (AUTH-02 exception)
    throw e;
  }
}

export const api = ky.create({
  prefixUrl: import.meta.env.VITE_API_URL,
  hooks: {
    beforeRequest: [
      (request) => {
        const { accessToken } = useAuthStore.getState();
        if (accessToken) request.headers.set("Authorization", `Bearer ${accessToken}`);
      },
    ],
    afterResponse: [
      async (request, options, response) => {
        if (response.status !== 401) return response;
        refreshPromise ??= refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
        const newAccessToken = await refreshPromise; // concurrent 401s await the SAME promise
        request.headers.set("Authorization", `Bearer ${newAccessToken}`);
        return ky(request); // retry once with the fresh token
      },
    ],
  },
});
```
**Trade-offs:** One extra shared-state variable outside React (module-level `refreshPromise`) — deliberate, since Zustand/React state updates are async and a race-free guard needs a plain synchronous check-and-set at the module level.

### Pattern 2: Route guard + role-aware shell via TanStack Router `beforeLoad`

**What:** A `_authenticated` layout route's `beforeLoad` checks for a resolved session (bootstraps `/me` if not yet loaded) and throws `redirect({ to: "/login" })` if it can't establish one. `AppShell` (mounted as that layout route's component) reads the resolved scope from context/store — never re-derives it.
**When to use:** Wraps every route except `/login` and `/signup`.
**Example:**
```typescript
// app/router.tsx
export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context }) => {
    const scope = await context.auth.ensureSession(); // bootstraps refresh + /me if needed, memoized
    if (!scope) {
      throw redirect({ to: "/login" });
    }
    return { scope };
  },
  component: AppShell,
});

// shared/auth/permissions.ts — literal TypeScript port of wheelio-api's scope.go
type OrgRole = "owner" | "admin" | "member";
type AgencyRole = "manager" | "agent" | "viewer";
const RANK: Record<AgencyRole, number> = { viewer: 1, agent: 2, manager: 3 };

export interface Scope {
  userId: string;
  orgId: string;
  orgRole: OrgRole;
  agencyRoles: Record<string, AgencyRole>; // agencyId -> role, from /me memberships
}

export function isOrgAdmin(scope: Scope): boolean {
  return scope.orgRole === "owner" || scope.orgRole === "admin";
}

export function roleInAgency(scope: Scope, agencyId: string): AgencyRole | undefined {
  if (isOrgAdmin(scope)) return "manager"; // org admins are implicit manager everywhere
  return scope.agencyRoles[agencyId];
}

export function canRead(scope: Scope, agencyId: string): boolean {
  return roleInAgency(scope, agencyId) !== undefined;
}

export function canOperate(scope: Scope, agencyId: string): boolean {
  const role = roleInAgency(scope, agencyId);
  return role !== undefined && RANK[role] >= RANK.agent;
}

export function canManage(scope: Scope, agencyId: string): boolean {
  const role = roleInAgency(scope, agencyId);
  return role !== undefined && RANK[role] >= RANK.manager;
}

// Build Scope from the /me response (meResponse shape) — the ONLY place this mapping happens
export function scopeFromMe(me: {
  user: { id: string; org_role: OrgRole };
  organization: { id: string };
  memberships: { agency_id: string; role: AgencyRole }[];
}): Scope {
  return {
    userId: me.user.id,
    orgId: me.organization.id,
    orgRole: me.user.org_role,
    agencyRoles: Object.fromEntries(me.memberships.map((m) => [m.agency_id, m.role])),
  };
}
```
**Trade-offs:** This duplicates backend logic in TypeScript — an explicit, acknowledged exception to "never duplicate role logic," justified because it's a *read-only UX mirror*, not a security boundary (the backend still enforces every mutation independently). Any change to `scope.go`'s rank/logic must be mirrored here — flag this file with a comment pointing back to the Go source.

### Pattern 3: Agency switcher — client-only state, no re-auth

**What:** Because `roleInAgency` returns `manager` unconditionally for org admins, switching the "current agency" is a pure Zustand state write; it does not call `/auth/refresh` or re-fetch `/me`. Later feature phases read `currentAgencyId` from this store to scope their own list/detail queries.
**Example:**
```typescript
// shared/auth/store.ts (excerpt)
interface AuthState {
  accessToken: string | null;         // memory only — never persisted
  refreshToken: string | null;        // persisted (see Pattern 4)
  scope: Scope | null;                // refetched via /me on boot/refresh, never persisted
  agencies: Agency[];                 // owner-only, from GET /agencies
  currentAgencyId: string | null;
  setCurrentAgency: (id: string) => void; // pure client state change, D-11
}
```

### Pattern 4: Zustand store with partial persistence for tokens

**What:** `persist` middleware's `partialize` writes only `refreshToken` (and, optionally, `currentAgencyId` for continuity across reloads — confirm with planner, see Open Questions) to `localStorage`; `accessToken` and `scope` are re-derived every boot and never serialized.
**Example:**
```typescript
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      scope: null,
      agencies: [],
      currentAgencyId: null,
      setTokens: ({ accessToken, refreshToken }) => set({ accessToken, refreshToken }),
      setCurrentAgency: (id) => set({ currentAgencyId: id }),
      clearSession: () => set({ accessToken: null, refreshToken: null, scope: null }),
    }),
    {
      name: "wheelio-auth",
      partialize: (state) => ({ refreshToken: state.refreshToken }),
    }
  )
);
```
[CITED: zustand.docs.pmnd.rs/reference/middlewares/persist]

### Pattern 5: shadcn/ui Vite dark mode — custom `ThemeProvider`, class-based `.dark` selector

**What:** shadcn's own official Vite guide (not the Next.js guide) ships a small context provider that toggles the `light`/`dark` class on `document.documentElement` and persists the choice to `localStorage`; Tailwind v4 CSS variables inside `:root` and `.dark` provide the actual token values (from UI-SPEC.md's Color table).
**Example:**
```typescript
// shared/ui/theme-provider.tsx — verbatim pattern from ui.shadcn.com/docs/dark-mode/vite
type Theme = "dark" | "light" | "system";
// ... (full implementation: see Code Examples section)
```
[CITED: ui.shadcn.com/docs/dark-mode/vite]

### Anti-Patterns to Avoid

- **Decoding the JWT client-side for role/permission info:** the access token contains only `sub`/`org` claims — there is nothing to decode. Any code that imports `jwt-decode` or similar for this purpose is working from a wrong assumption; always use `/me`.
- **Re-fetching `/me` or calling `/auth/refresh` on agency switch:** unnecessary network round-trip; the switch is a pure client state change (Pattern 3).
- **Per-request independent 401→refresh→retry (no shared promise):** triggers the rotating-refresh theft-detection path, causing a random full-session logout the moment two requests race (Pitfall 1 in PITFALLS.md, now confirmed concretely by the API's `RevokeAllForUser` behavior on stale-refresh reuse).
- **Using `next-themes` in this Vite app:** unnecessary dependency; shadcn documents a Vite-native alternative.
- **Adding `i18next-icu` by default:** not needed for this phase's copy (no gendered/nested-select strings in UI-SPEC.md); adds an SUS-flagged, low-adoption dependency for no current benefit.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| French plural resolution (0 vs 1 vs 2+) | Manual `count === 1 ? x : y` ternaries | i18next's built-in `Intl.PluralRules`-backed `_one`/`_other` suffixes | French's CLDR `one` category legitimately includes both 0 and 1 — a ternary gets this wrong; the platform's `Intl.PluralRules('fr')` gets it right for free |
| JWT refresh race handling | Ad hoc `isRefreshing` boolean flag checked/set across call sites | The single shared `Promise` pattern (Pattern 1) | A boolean flag has a check-then-act race under async JS; a shared Promise is inherently the correct dedupe primitive |
| Role/permission checks | Per-component `if (user.role === 'agent')` | `permissions.ts` (Pattern 2) | Backend is the authority; any independent client logic drifts as roles evolve |
| Dark-mode token values | Ad hoc `dark:` Tailwind utility per component | CSS variables defined once (`:root`/`.dark`), consumed via shadcn's token classes | AUTH-06 explicitly requires *one* documented system, not per-component overrides |
| Auth-persisted storage | Manually reading/writing `localStorage` in components | Zustand `persist` + `partialize` (Pattern 4) | Centralizes the "only the refresh token, never the access token" rule in one place |

**Key insight:** Every one of this phase's "don't hand-roll" items is a place where a first-glance-reasonable manual implementation is subtly wrong under a specific condition (French grammar at the 0/1 boundary, concurrent requests, evolving roles, cross-component style drift, XSS-token exposure) that won't show up until later — exactly the pattern PITFALLS.md warns about project-wide.

## Common Pitfalls

### Pitfall 1: Refresh-token stampede triggers the API's own theft-detection revocation
**What goes wrong:** Two or more requests hit 401 within the same tick (e.g., `/me` + `GET /agencies` on shell load). Each independently POSTs `/auth/refresh` with the same (still-valid-looking) refresh token. The API rotates on the first call, revoking that token; the second call's `Refresh()` sees a token whose `Usable()` check fails post-rotation-but-pre-revocation-check window, or (worse, confirmed in `auth.go`) if the second refresh arrives with the *already-rotated-out* raw token, `RevokeAllForUser` fires and the user is force-logged-out mid-session.
**Why it happens:** No dedupe between concurrent 401 handlers.
**How to avoid:** Pattern 1's shared promise, enforced from the very first authenticated call this phase makes (`GET /me`).
**Warning signs:** Multiple `POST /auth/refresh` calls in the network tab within milliseconds of each other; random logout correlated with pages that fire >1 request on load.

### Pitfall 2: Treating the JWT as a claims source for role/nav decisions
**What goes wrong:** A developer reaches for a JWT-decode utility to read "the user's role" out of the access token, because that's the generic pattern for most JWT tutorials. `wheelio-api`'s token has no such claim — `accessClaims` is `{ sub, org, exp, iat }` only (`internal/adapter/auth/jwt.go`). Code written this way either crashes (field missing) or silently always falls into a default-role branch.
**Why it happens:** JWT-role-decoding is such a common pattern elsewhere that its absence here is easy to miss without reading the actual issuer code.
**How to avoid:** Every role/permission decision goes through `/me` → `scopeFromMe()` → `permissions.ts`. Never attempt to decode the access token for anything beyond, at most, treating it as an opaque bearer string.
**Warning signs:** Any import of `jwt-decode` or manual base64 JWT-payload parsing in frontend code.

### Pitfall 3: i18n retrofit / naive pluralization (project-level Pitfall 8, now scoped concretely)
**What goes wrong:** See PITFALLS.md Pitfall 8 in full; this phase's specific manifestation is choosing the wrong tool for the plural problem — either hardcoding strings before i18next is wired at all, or reaching for a heavier ICU plugin than necessary for the actual copy inventory in UI-SPEC.md (which has no gendered strings this phase).
**How to avoid:** Wire i18next with v4 JSON key suffixes (`_one`/`_other`) from the first component; enforce via code review that no bare JSX string literal ships. Revisit `i18next-icu` only if a later phase needs `select`/gender formatting.

### Pitfall 4: Agency switcher accidentally re-triggering an auth/scope refetch
**What goes wrong:** A well-meaning implementation calls `/me` again "to be safe" on every agency switch, adding latency and a loading flicker to what CONTEXT.md (D-11) explicitly wants to be instant/in-place.
**How to avoid:** Confirm and document (Pattern 3) that agency-switch is scope-independent for org admins; only feature-phase list/detail queries change their `agency_id` param, not the auth/scope layer.

### Pitfall 5: Design tokens defined but not actually wired into the shadcn CSS-variable layer
**What goes wrong:** UI-SPEC.md's token values (colors, spacing, type scale) get hardcoded as Tailwind arbitrary values (`bg-[#2563EB]`) per-component instead of being registered once as CSS variables that shadcn's `new-york` components already reference — this technically "ships the colors" but defeats AUTH-06's "documented, applied consistently" requirement and makes the dark-mode variant a second manual pass instead of automatic.
**How to avoid:** Define every UI-SPEC.md token as a CSS custom property in `:root` (light) and `.dark` (dark) exactly once, matching shadcn's expected variable names (`--background`, `--foreground`, `--primary`, etc. per `components.json`'s `cssVariables: true` convention), then reference them only via Tailwind's `bg-primary`/`text-foreground` etc. — never introduce a parallel hardcoded hex value.

## Code Examples

### Full shadcn Vite `ThemeProvider` (dark mode)
```typescript
// Source: https://ui.shadcn.com/docs/dark-mode/vite
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = { theme: "system", setTheme: () => null };
const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "wheelio-ui-theme",
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.add(systemTheme);
      return;
    }
    root.classList.add(theme);
  }, [theme]);

  const value = {
    theme,
    setTheme: (t: Theme) => {
      localStorage.setItem(storageKey, t);
      setTheme(t);
    },
  };

  return <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>;
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};
```

### i18next initialization with FR-default and v4 plurals
```typescript
// shared/i18n/index.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import fr from "./fr/common.json";
import en from "./en/common.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { fr: { common: fr }, en: { common: en } },
    fallbackLng: "fr",       // FR is the hard default per AUTH-05
    lng: undefined,           // let LanguageDetector suggest, but fallbackLng wins if nothing stored
    ns: ["common"],
    defaultNS: "common",
    interpolation: { escapeValue: false }, // React already escapes
  });

export default i18n;

// fr/common.json — v4 plural suffix example, correctly renders "0 véhicule" / "1 véhicule" / "2 véhicules"
// {
//   "vehicleCount_one": "{{count}} véhicule",
//   "vehicleCount_other": "{{count}} véhicules"
// }
```

### `/me` DTO types mirroring the API exactly
```typescript
// types/identity.ts — mirrors wheelio-api's dto.go 1:1
export interface UserResponse {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  org_role: "owner" | "admin" | "member";
  is_active: boolean;
  created_at: string;
}

export interface OrganizationResponse {
  id: string;
  name: string;
  created_at: string;
}

export interface MembershipResponse {
  user_id: string;
  agency_id: string;
  role: "manager" | "agent" | "viewer";
  created_at: string;
}

export interface MeResponse {
  user: UserResponse;
  organization: OrganizationResponse;
  memberships: MembershipResponse[];
}

export interface AuthResponse {
  token_type: "Bearer";
  access_token: string;
  access_token_expires_at: string; // ISO 8601
  refresh_token: string;
  user: UserResponse;
  organization: OrganizationResponse;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| i18next v3 JSON plural keys (`_plural` suffix, English-biased) | i18next v4 JSON keys (`_one`/`_other`/`_zero`/etc., CLDR/`Intl.PluralRules`-driven) | Mandatory since i18next v24 (this project installs 26.3.6) | No manual plural-rule code needed for French; `compatibilityJSON: 'v3'` escape hatch no longer exists — don't reach for it |
| Axios interceptor arrays for auth | ky's hook-based `beforeRequest`/`afterResponse` | Ongoing 2024-2026 shift toward smaller fetch wrappers | Same conceptual pattern, smaller API surface, already the project's chosen client |
| `next-themes` as the default dark-mode solution for any React app | Framework-specific guides (shadcn now ships a dedicated Vite doc distinct from its Next.js doc) | shadcn's docs restructuring around framework-specific setup guides | Don't default to Next-ecosystem packages just because they're popular; check for a framework-native doc first |

**Deprecated/outdated:**
- i18next `compatibilityJSON: 'v3'` — removed as an option in v24+; do not reference old i18next tutorials that show `_plural` (singular "plural" suffix, not CLDR categories).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Whether `currentAgencyId` (owner's selected agency) should persist across a page reload/new tab, or reset to a default (e.g. first agency alphabetically) each session | Pattern 3/4 | Low-medium: if planner doesn't decide explicitly, an inconsistent UX could emerge (owner expects to stay on the agency they were viewing, but a fresh tab silently resets it) — CONTEXT.md D-11 only covers in-session switching, not cross-reload persistence |
| A2 | Zero-agency edge case (an org with literally no agencies yet) is out of scope for Phase 1's switcher, since UI-SPEC.md's "zero-one-many" resolution only discusses the one-agency case explicitly | UI-SPEC.md cross-reference | Low: likely impossible in practice (an org is created with at least one agency via signup flow) but not explicitly ruled out in research |
| A3 | `@fontsource-variable/inter` self-hosting is preferred over Google Fonts CDN link, based on general field-usage/offline-tolerance reasoning carried over from project research, not a CONTEXT.md decision | Standard Stack / Alternatives | Low: either choice works; if bundle-size becomes a concern the CDN link is a trivial swap |

**If this table is empty:** N/A — see rows above; all are low/medium-risk implementation-detail assumptions, not core-decision risks (every CONTEXT.md gray area was already resolved per that document).

## Open Questions (RESOLVED)

1. **Should `currentAgencyId` persist across page reloads for the owner role?** — **RESOLVED at plan time (01-03 Task 2): default to NOT persisting** (resets to the org's first/primary agency on fresh load). Recorded as a flagged assumption in 01-03's SUMMARY for executor confirmation, per this research's own recommendation below.
   - What we know: D-11 only requires no reset "on switch" (within-session); nothing in CONTEXT.md addresses reload/new-tab behavior.
   - What's unclear: whether "always land back where you were" extends across a full reload.
   - Recommendation (adopted): default to NOT persisting as the simpler behavior — low cost either way, flagged for confirmation rather than silently decided.

2. **Exact CSS variable names shadcn expects for the `new-york`/`slate`/custom-token combination.** — **RESOLVED as an execution-time step, not a planning-time answer**: 01-02's tasks read the generated CSS at execution time rather than guessing variable names now.
   - What we know: `npx shadcn init` with `cssVariables: true` generates a standard set (`--background`, `--foreground`, `--primary`, `--primary-foreground`, `--muted`, `--border`, etc.) that UI-SPEC.md's token table must map onto.
   - What's unclear: the precise generated variable list depends on the shadcn CLI's current version at execution time (not independently re-verified in this pass beyond the dark-mode pattern above).
   - Recommendation (adopted): run `npx shadcn@latest init` first during execution and read the generated `src/index.css`/`globals.css` before hand-editing token values — don't guess variable names from memory.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (for Vite/npm) | Entire toolchain | ✓ | (verify at execution time via `node --version`, requires Node ≥20 for Vite 8) | — |
| npm registry network access | Package install, this research's own verification | ✓ | — (confirmed live during this research session) | — |
| `wheelio-api` running locally (for manual auth-flow testing) | Manual UAT of login/refresh/me | Not verified this session — confirm at execution/plan time | — | Use MSW mocks for automated tests regardless; manual UAT needs a live or containerized API instance |

**Missing dependencies with no fallback:** none identified as blocking for the build itself (MSW covers automated-test API mocking regardless of local API availability).
**Missing dependencies with fallback:** live `wheelio-api` instance for manual UAT — MSW-mocked contract testing can proceed without it; real end-to-end auth verification (token rotation, actual 15-min TTL behavior) requires the real API at some point before phase sign-off.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (unit/component) + Playwright 1.61.1 (E2E) + @testing-library/react + MSW |
| Config file | none yet — Wave 0 |
| Quick run command | `npx vitest run --reporter=dot` (once configured) |
| Full suite command | `npx vitest run && npx playwright test` (once configured) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|-------------|
| AUTH-01 | Login succeeds, tokens stored correctly (access in memory, refresh persisted) | unit + integration (MSW) | `npx vitest run src/features/auth` | ❌ Wave 0 |
| AUTH-01 | Concurrent 401s trigger exactly one refresh call | unit (mock ky + fake timers) | `npx vitest run src/shared/api/client.test.ts` | ❌ Wave 0 |
| AUTH-02 | Refresh failure redirects to login with the correct copy; refresh success never redirects | integration (MSW + router test harness) | `npx vitest run src/app/router.test.tsx` | ❌ Wave 0 |
| AUTH-03 | Nav renders base items for all roles; admin sections only for org admins | component (Testing Library, scope fixture) | `npx vitest run src/app/shell/AppShell.test.tsx` | ❌ Wave 0 |
| AUTH-04 | Switching agency updates `currentAgencyId` without a new `/me`/`/auth/refresh` call | unit (Zustand store + MSW call-count assertion) | `npx vitest run src/shared/auth/store.test.ts` | ❌ Wave 0 |
| AUTH-05 | FR default renders; language switch updates all visible strings instantly; French plural at count=0 renders singular | component + snapshot | `npx vitest run src/shared/i18n` | ❌ Wave 0 |
| AUTH-06 | Dark/light theme toggle updates the `.dark` class and persists across reload | component (jsdom + localStorage mock) | `npx vitest run src/shared/ui/theme-provider.test.tsx` | ❌ Wave 0 |
| AUTH-01/02/03 (E2E) | Full login → shell → role-gated nav happy path | E2E | `npx playwright test e2e/auth.spec.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run` (targeted to the touched files)
- **Per wave merge:** `npx vitest run && npx playwright test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` + `vite.config.ts` test block — framework install/config, none exists yet (greenfield repo)
- [ ] `playwright.config.ts` — E2E framework config
- [ ] `src/test/setup.ts` — jest-dom matchers, MSW server bootstrap
- [ ] `src/test/mocks/handlers.ts` — MSW handlers mirroring `authResponse`/`meResponse`/`agencyResponse` shapes confirmed in this research
- [ ] `src/test/fixtures/scope.ts` — reusable `Scope` fixtures per role (agent/manager/owner) for `permissions.ts` and `AppShell` tests
- [ ] Framework install: `npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom msw @playwright/test`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | yes | Delegated entirely to `wheelio-api` (Argon2id, timing-equalizer anti-enumeration already implemented server-side); frontend only collects credentials via a standard HTTPS POST, never logs them, never client-side-hashes (that would weaken, not strengthen, the server's own hashing) |
| V3 Session Management | yes | Access token in-memory only (never `localStorage`/`sessionStorage`); refresh token in `localStorage` is the project's documented, accepted compromise (STACK.md) given the API's plain-JSON token contract — mitigated by short access-TTL (15min), rotating refresh with theft detection (server-side), and this phase's single-flight client logic avoiding self-inflicted premature invalidation |
| V4 Access Control | yes | Frontend `permissions.ts` is UX-only (Pattern 2); every state-changing request still relies on `wheelio-api`'s independent `Scope` enforcement — this phase's own UAT should include at least one "hidden button, call the API directly" spot-check before sign-off (per PITFALLS.md Pitfall 6's "Looks Done But Isn't" checklist) |
| V5 Input Validation | yes | React Hook Form + Zod schemas for login/signup forms (email format, password min length ≥8 to match backend's `validate:"required,min=8"`); client-side validation is a UX nicety, backend re-validates independently (`bindAndValidate`) |
| V6 Cryptography | no (frontend does not implement crypto) | Argon2id hashing is entirely server-side; frontend never handles raw password comparison or generates its own tokens |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| XSS exfiltrating the `localStorage` refresh token | Information Disclosure | Strict CSP (no inline scripts, no third-party script injection), keep the access token entirely out of persistent storage so even a successful XSS only exposes the refresh token (bounded by its 30-day TTL and rotation/theft-detection), avoid `dangerouslySetInnerHTML` anywhere in this phase's components |
| Refresh-token replay after rotation (stolen or leaked-and-reused old token) | Spoofing / Tampering | Already mitigated server-side (`RevokeAllForUser` on stale-token reuse) — frontend's job is simply to never independently retry a refresh with a token it already successfully rotated away from (Pattern 1's single-flight guard also prevents this client-side symptom) |
| Open redirect via a manipulated post-login return URL | Tampering | If a "redirect back to where you were" pattern is added for the login flow, validate the target is an internal route (not an arbitrary external URL) before navigating — not yet a feature in this phase's scope (no deep-link-then-login flow specified), flag if added later |
| Client-side-only role gating mistaken for real authorization | Elevation of Privilege | Documented explicitly in Pattern 2/Anti-Patterns; verified server-side independently per ASVS V4 row above |

## Sources

### Primary (HIGH confidence)
- `wheelio-api` source, read directly this session: `internal/adapter/httpapi/auth_handler.go`, `internal/adapter/httpapi/dto.go`, `internal/domain/identity/scope.go`, `internal/domain/identity/roles.go`, `internal/domain/identity/token.go`, `internal/usecase/identity/auth.go`, `internal/adapter/httpapi/middleware/auth.go`, `internal/adapter/httpapi/agency_handler.go`, `internal/adapter/httpapi/server.go` (routes), `internal/adapter/auth/jwt.go` (JWT claims shape), `internal/platform/config/config.go` (TTL defaults) — all confirmed by direct file read, not inference.
- npm registry (`registry.npmjs.org`), live lookups this session for: i18next-icu, class-variance-authority, tailwind-merge, clsx, next-themes, @fontsource-variable/inter, react, react-dom, vite, typescript, @tanstack/react-router, @tanstack/react-query, tailwindcss, react-hook-form, zod, zustand, i18next, react-i18next, i18next-browser-languagedetector, ky, lucide-react, @hookform/resolvers.

### Secondary (MEDIUM confidence)
- [TanStack Router — Authenticated Routes](https://tanstack.com/router/latest/docs/guide/authenticated-routes) — `beforeLoad` guard pattern
- [shadcn/ui — Vite Dark Mode](https://ui.shadcn.com/docs/dark-mode/vite) — `ThemeProvider` implementation, verbatim-cited code
- [i18next — Plurals](https://www.i18next.com/translation-function/plurals) — v4/`Intl.PluralRules` mandatory-since-v24 confirmation
- [i18next-icu GitHub / npm](https://github.com/i18next/i18next-icu) — install/setup, "i18next-specific features unavailable" caveat
- [Zustand — persist middleware](https://zustand.docs.pmnd.rs/reference/middlewares/persist) — `partialize` option
- [ky GitHub Discussions #381, #538](https://github.com/sindresorhus/ky/discussions/381) — `afterResponse` vs `beforeRetry` for 401 handling

### Tertiary (LOW confidence)
- None carried forward as authoritative in this pass beyond what's cited above; project-level PITFALLS.md/ARCHITECTURE.md/STACK.md sources (already MEDIUM/HIGH per those documents) are referenced by cross-link, not re-verified line-by-line here.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified live against npm registry this session; API contract details verified by direct source read
- Architecture: HIGH for the API-contract-dependent parts (refresh rotation, `/me` shape, agency-switch no-op), MEDIUM for the general TanStack Router/ky community patterns (cross-checked but not official-framework-doc-exhaustive)
- Pitfalls: HIGH — this phase's five pitfalls are each traced to a specific, confirmed line of `wheelio-api` source (JWT claims shape, rotation/theft-detection logic, `RoleInAgency`'s org-admin shortcut) rather than generic web-sourced pattern-matching

**Research date:** 2026-07-22
**Valid until:** 30 days (stable framework choices; re-verify package versions if execution is materially delayed, and re-check `wheelio-api`'s auth code hasn't changed if that repo receives commits in the interim)
