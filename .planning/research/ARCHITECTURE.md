# Architecture Research

**Domain:** Role-based SaaS fleet-management dashboard (frontend only, consumes existing REST/JWT API)
**Researched:** 2026-07-22
**Confidence:** MEDIUM (patterns cross-checked across multiple independent 2025-2026 sources; no official framework docs consulted directly in this pass — see Sources)

**Assumption carried from ecosystem research:** React 19 + TypeScript + Vite, TanStack Query (server state) + Zustand (client state), React Router v7 (routing/guards), React Hook Form + Zod (forms), Axios (HTTP client). If `STACK.md` picks differently, the *patterns* below still apply — only the exact API surface changes (e.g. TanStack Router loaders instead of RR v7 loaders).

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Routing / Shell Layer                        │
│  Public routes (login)  │  Authenticated shell (role-aware layout)    │
│                         │  ┌─────────┬─────────┬─────────┐            │
│                         │  │ Agent   │ Manager │ Owner   │ nav/menu   │
│                         │  │ layout  │ layout  │ layout  │ variants   │
│                         │  └─────────┴─────────┴─────────┘            │
├──────────────────────────────────────────────────────────────────────┤
│                          Feature Modules (screaming architecture)     │
│  ┌────────┐ ┌───────────┐ ┌──────────┐ ┌────────────┐ ┌────────────┐ │
│  │ fleet  │ │ customers │ │ rentals  │ │ inspections│ │  billing   │ │
│  │(vehic.)│ │(clients)  │ │(contract)│ │  (EDL)     │ │ (invoices) │ │
│  └───┬────┘ └────┬──────┘ └────┬─────┘ └─────┬──────┘ └─────┬──────┘ │
│      │           │             │             │              │        │
├──────┴───────────┴─────────────┴─────────────┴──────────────┴────────┤
│                     Data / Server-State Layer                         │
│      TanStack Query hooks (useFleet, useContract, useInspection...)   │
│                              ↓ calls                                  │
│                   Typed API client (fetch/axios wrapper)              │
│         - injects Authorization: Bearer <access_token>                │
│         - 401 → refresh-and-retry interceptor (single-flight + queue)│
│         - typed request/response DTOs mirroring wheelio-api contract │
├──────────────────────────────────────────────────────────────────────┤
│                     Client / UI State Layer                          │
│  ┌───────────┐  ┌──────────────┐  ┌────────────────┐                 │
│  │ auth store│  │ upload queue │  │ ui prefs (i18n,│                 │
│  │ (Zustand) │  │ store        │  │ theme, toasts) │                 │
│  └───────────┘  └──────────────┘  └────────────────┘                 │
└──────────────────────────────────────────────────────────────────────┘
                                ↓ HTTPS / JSON / multipart
                          wheelio-api (Go, JWT, RLS)
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|-------------------------|
| Routing/Shell | Defines route tree, mounts the correct layout shell per authenticated role, redirects unauthenticated users | React Router v7 route config with nested layout routes; a `RequireAuth` layout route wraps everything past login |
| Role Layout (agent/manager/owner) | Renders the nav/menu appropriate to the role, NOT a duplicate of business logic | One `AppShell` component parametrized by `scope` (from `/me`), not three separate shells — avoids drift |
| Feature module (`fleet`, `customers`, `rentals`, `inspections`, `billing`) | Owns everything needed for that business capability: pages, components, query hooks, mutation hooks, Zod schemas, DTO types | Self-contained folder; imports only from `shared/` and its own subtree, never from a sibling feature folder directly |
| API client | Single source of truth for talking to `wheelio-api`: base URL, auth header injection, refresh-on-401, error normalization, multipart helpers | Thin `axios` (or `fetch`) wrapper in `shared/api/client.ts`; feature hooks call typed functions from `shared/api/*.ts`, never `fetch` directly in components |
| TanStack Query hooks | Cache, dedupe, and synchronize server data per feature; own loading/error/stale states | `useVehicles()`, `useContract(id)`, one query-key factory per feature to keep invalidation consistent |
| Auth store (Zustand) | Holds decoded scope/role/permissions + access token in memory, exposes `login`/`logout`/`refresh` actions | Small store, persisted only for "remember session" flag; access token kept in memory, refresh token in httpOnly-cookie-equivalent handled by API client, not app state |
| Upload queue store | Tracks in-flight/queued/failed photo uploads for the inspection flow, independent of any single screen | Zustand store (or a dedicated reducer) keyed by local temp-id, survives navigation within the inspection session |
| Permission utility | Single function(s) translating `Scope` (CanRead/CanOperate/CanManage/IsOrgAdmin) into UI decisions | Pure functions in `shared/auth/permissions.ts`, consumed both by route guards and by inline `disabled=` checks — one source of truth, never re-derived per component |

## Recommended Project Structure

```
src/
├── app/                      # App bootstrap, providers, route tree
│   ├── router.tsx            # Route config, layout routes, guards
│   ├── providers.tsx         # QueryClientProvider, AuthProvider, i18nProvider
│   └── shell/                # AppShell, Sidebar, TopBar (role-aware, single impl)
├── features/                 # One folder per business capability
│   ├── auth/                 # login form, session bootstrap, useAuth()
│   ├── fleet/                 # vehicle list/detail, status, mileage
│   ├── customers/             # client CRUD, designated drivers
│   ├── rentals/                # contract lifecycle: reserve/activate/close/cancel
│   ├── inspections/             # EDL sortie/retour, damage zones, photo capture
│   └── billing/                 # invoice view, payments, avoir, PDF downloads
│   └── each feature/
│       ├── api.ts             # typed request functions (calls shared/api/client)
│       ├── queries.ts          # useQuery/useMutation hooks + query-key factory
│       ├── schemas.ts           # Zod schemas + inferred types
│       ├── components/           # feature-local components
│       └── pages/                 # route-mounted page components
├── shared/                    # Cross-cutting, framework-agnostic-ish code
│   ├── api/
│   │   ├── client.ts          # axios instance, auth header, refresh interceptor
│   │   ├── download.ts         # blob-download / inline-preview helper for PDFs
│   │   └── upload.ts            # multipart upload helper w/ retry
│   ├── auth/
│   │   ├── store.ts            # Zustand auth store
│   │   └── permissions.ts        # Scope → boolean helpers, single source of truth
│   ├── ui/                      # design-system components (Button, Table, Modal...)
│   └── i18n/                     # fr/en resources, i18next setup
└── types/                     # DTOs mirroring wheelio-api contract (generated or hand-kept)
```

### Structure Rationale

- **`features/`:** matches the way the product is actually sold and demoed (vertical slices: fleet → customer → contract → EDL → invoice). A feature can be added or removed without touching unrelated code — directly supports the "core path first, defer maintenance/documents" strategy in PROJECT.md.
- **`shared/api/client.ts` as the only place that talks JWT/HTTP:** the two-step upload-then-attach flow and the Bearer-header PDF stream both need custom handling (multipart, blob) that must not be reinvented per feature.
- **`shared/auth/permissions.ts` as the only place that reads `Scope`:** PROJECT.md is explicit that the front "must never duplicate an independent role logic" — centralizing this is a hard architectural constraint, not a nicety.
- **`app/shell/` holds one `AppShell`, not three:** three roles differ in *which* nav items and actions are visible/enabled, not in a fundamentally different page structure — one parametrized shell prevents the three-codebases-that-drift-apart anti-pattern.

## Architectural Patterns

### Pattern 1: Layout-route guarding + permission-driven UI (not three separate apps)

**What:** A single top-level `RequireAuth` layout route protects everything behind login (redirect to `/login` if no valid session). Below that, one `AppShell` layout reads the resolved `Scope` (from `/me` + JWT claims) and renders nav items conditionally. Inside pages, individual actions (buttons, form fields, PDF-issue button) are hidden or disabled based on the same `Scope` helpers — never a second, independent permission model.
**When to use:** Any app with >1 role sharing most of the same page structure, which is the case here (agent/manager/owner all see fleet/rentals/inspections, only *scope* differs).
**Trade-offs:** Hiding vs. disabling is a UX choice, not an architecture choice — hide entire nav sections the role can never use (e.g., agents likely never see org-level settings), but *disable with a tooltip* actions the role can see-but-not-do (e.g., an agent viewing a contract but unable to close it) so the user understands the workflow exists. Never rely on hiding alone for security — every mutating call must be re-validated by the backend (already true here, since RLS/RBAC live in `wheelio-api`).

**Example:**
```typescript
// shared/auth/permissions.ts — single source of truth
export function canManageContracts(scope: Scope, agencyId: string) {
  return scope.canOperate(agencyId) || scope.isOrgAdmin;
}

// app/router.tsx
{
  path: "/",
  element: <RequireAuth />,        // redirects to /login if no session
  children: [
    {
      element: <AppShell />,        // reads scope, renders role-aware nav
      children: [
        { path: "fleet", element: <FleetListPage /> },
        { path: "rentals/:id", element: <ContractDetailPage /> },
        // every child route trusts AppShell already gated auth;
        // per-action checks still happen inline via permissions.ts
      ],
    },
  ],
}

// inside ContractDetailPage
<Button disabled={!canManageContracts(scope, agencyId)} onClick={closeContract}>
  Clôturer le contrat
</Button>
```

### Pattern 2: Server state via TanStack Query + a single API client with transparent refresh

**What:** All server data (vehicles, contracts, inspections, invoices) flows through TanStack Query hooks that call a typed API client. The client owns JWT lifecycle: it attaches `Authorization: Bearer <access>` on every request and, on a `401`, pauses the failing request, performs a single refresh call (queueing any other concurrent 401s behind it), retries once with the new token, and force-logs-out if refresh itself fails.
**When to use:** Any CRUD-heavy app talking to a JWT REST API — exactly this project's shape.
**Trade-offs:** Adds one moving part (the refresh queue) but removes the alternative failure mode (every feature hook re-implementing its own 401 handling, which *will* drift and cause silent double-logouts or race conditions on concurrent requests, e.g. loading a contract + its inspection + its invoice at once).

**Example:**
```typescript
// shared/api/client.ts
let refreshPromise: Promise<string> | null = null;

api.interceptors.response.use(undefined, async (error) => {
  if (error.response?.status !== 401 || error.config._retried) throw error;
  error.config._retried = true;
  refreshPromise ??= refreshAccessToken().finally(() => { refreshPromise = null; });
  const newToken = await refreshPromise; // concurrent 401s await the same promise
  error.config.headers.Authorization = `Bearer ${newToken}`;
  return api.request(error.config);
});

// features/rentals/queries.ts
export const contractKeys = { detail: (id: string) => ["rentals", id] as const };
export function useContract(id: string) {
  return useQuery({ queryKey: contractKeys.detail(id), queryFn: () => getContract(id) });
}
```

### Pattern 3: Two-step "upload then attach" with a per-file state machine

**What:** The inspection photo flow is inherently two calls: `POST /vehicles/:vehicleID/documents` (multipart, returns `document_id`), then a second call attaching that `document_id` to the damage record. Model this explicitly as a client-side state machine per photo — `idle → uploading → uploaded(document_id) → attaching → attached | failed(step, reason)` — rather than one opaque "saving..." spinner. Persist the queue (React state is enough for a single EDL session; IndexedDB only needed if true offline-first is required later) so a lost connection mid-upload doesn't lose the photo — retry resumes at the failed step, not from zero.
**When to use:** Any workflow that chains two independent server calls where the field connection may drop between them (exactly the damage-inspection photo capture, done "on the terrain" per PROJECT.md).
**Trade-offs:** More UI state to manage than a naive "upload and forget," but it is the only way to avoid orphaned documents (uploaded but never attached) or silently-lost damage evidence, both are worse outcomes than a visible retry button for a legal/insurance record.

**Example:**
```typescript
type PhotoUploadState =
  | { status: "idle" }
  | { status: "uploading"; progress: number }
  | { status: "uploaded"; documentId: string }
  | { status: "attaching" }
  | { status: "attached" }
  | { status: "failed"; step: "upload" | "attach"; error: string };

async function uploadAndAttach(file: File, damageRecordId: string, set: (s: PhotoUploadState) => void) {
  set({ status: "uploading", progress: 0 });
  let documentId: string;
  try {
    documentId = await uploadDocument(file, { onProgress: (p) => set({ status: "uploading", progress: p }) });
  } catch (e) {
    return set({ status: "failed", step: "upload", error: String(e) }); // retry re-enters here
  }
  set({ status: "uploaded", documentId });
  try {
    set({ status: "attaching" });
    await attachDamagePhoto(damageRecordId, documentId);
    set({ status: "attached" });
  } catch (e) {
    // upload already succeeded — retry only needs to re-attempt attach, not re-upload
    set({ status: "failed", step: "attach", error: String(e) });
  }
}
```

### Pattern 4: Authenticated Blob download/preview for server-streamed PDFs

**What:** Because `wheelio-api` streams `application/pdf` bytes and requires a Bearer token, a plain `<a href>` or `window.open(url)` cannot authenticate the request (browsers don't attach custom headers to top-level navigations). The standard pattern is: `fetch`/`axios` the endpoint with the Authorization header → read the response as a `Blob` → `URL.createObjectURL(blob)` → either programmatically click a hidden `<a download>` (force download) or set the object URL as an `<iframe>`/`<embed>` `src` or a new-tab `window.open(objectUrl)` (inline preview). Always `URL.revokeObjectURL()` after use to release memory.
**When to use:** Every PDF button in this app — facture, contrat, état des lieux — since all are streamed with auth, never cached client-side, and never client-rendered.
**Trade-offs:** Requires holding the whole PDF in memory as a Blob (fine at typical invoice/contract PDF sizes, a non-issue here); in exchange it's the only approach that works with Bearer-token auth without resorting to short-lived signed URLs (which `wheelio-api`'s document endpoints already use for *files*, but the PDF endpoints per PROJECT.md are streamed directly, not signed-URL-backed).

**Example:**
```typescript
// shared/api/download.ts
export async function downloadAuthenticatedPdf(url: string, filename: string) {
  const res = await api.get(url, { responseType: "blob" }); // axios instance w/ auth header
  const blobUrl = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(blobUrl);
}

export async function previewAuthenticatedPdf(url: string): Promise<string> {
  const res = await api.get(url, { responseType: "blob" });
  return URL.createObjectURL(res.data); // caller sets as <iframe src> and revokes on unmount
}
```

## Data Flow

### Request Flow (typical CRUD action, e.g. "close a contract")

```
[User clicks "Clôturer"]
    ↓
[ContractDetailPage] → [useCloseContract() mutation] → [rentals/api.ts closeContract()]
    ↓                                                          ↓
[permissions.ts check (disabled if !canManage)]      [api client: attach Bearer, POST /rentals/:id/close]
                                                                ↓
                                              [401? → refresh queue → retry] → wheelio-api
    ↓                                                          ↓
[onSuccess: queryClient.invalidateQueries(contractKeys.detail(id))] ← [200 response]
    ↓
[TanStack Query refetches, UI re-renders with closed status]
```

### State Management

```
[Auth store (Zustand)] ── scope/role ──→ [AppShell, route guards, permissions.ts]
[TanStack Query cache] ── server data ──→ [Feature pages] ──mutations──→ [invalidate keys] → cache
[Upload queue store]  ── per-photo state ──→ [Inspection capture UI] ──retries──→ [api client]
```

### Key Data Flows

1. **Auth bootstrap:** on app load, read persisted refresh capability (cookie or storage per STACK.md decision) → silently attempt refresh → populate auth store with scope from `/me` → route guards unlock → if it fails, redirect to `/login`. This must complete (or fail) before the route tree renders protected routes, to avoid a flash of unauthenticated content.
2. **Inspection photo capture:** camera/file input (mobile browser `<input type="file" accept="image/*" capture>`) → local preview → `uploadAndAttach` state machine (Pattern 3) → on success, TanStack Query invalidates the inspection's damage-photo list so the sortie/retour comparison view refreshes.
3. **PDF issuance:** user clicks "Télécharger facture" → Pattern 4 fetch-as-blob → either force-download or open inline preview tab, no client-side PDF rendering/generation ever happens (backend is the sole source of the PDF bytes, per PROJECT.md constraint).

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Single agency, demo/pilot (v1 target) | Everything above as-is; no code-splitting needed beyond route-based lazy loading (`React.lazy` per feature folder) for initial bundle size |
| Tens of agencies, one org each | No architecture change — RLS/multi-tenancy is entirely a backend concern; frontend already scopes all requests by the org/agency in the JWT-derived context |
| Hundreds of concurrent field users on 3G/4G | Upload queue (Pattern 3) becomes more valuable — consider persisting it to IndexedDB so a killed mobile-browser tab doesn't lose in-progress inspection photos; this is a incremental upgrade to the same pattern, not a rewrite |

### Scaling Priorities

1. **First bottleneck:** bundle size as feature count grows (fleet+customers+rentals+inspections+billing all at once) → mitigate with route-based code-splitting per feature folder from day one (cheap to set up, expensive to retrofit).
2. **Second bottleneck (only if usage grows well past v1):** losing in-progress uploads on tab-kill in the field → upgrade the upload queue store to persist to IndexedDB; the state-machine shape (Pattern 3) doesn't change, only its storage backing.

## Anti-Patterns

### Anti-Pattern 1: Re-deriving role/permission logic per component

**What people do:** Sprinkle `if (user.role === "manager" || user.role === "owner")` checks inline across dozens of components instead of going through one `permissions.ts`.
**Why it's wrong:** PROJECT.md is explicit that the backend already computes `Scope.CanRead/CanOperate/CanManage` + `IsOrgAdmin` — duplicating that logic client-side, even slightly differently per component, guarantees the UI and the API disagree eventually (e.g. an agent sees a "close contract" button that the backend then 403s).
**Instead:** One `permissions.ts` module wrapping the `/me`-derived `Scope`; every guard and every disabled= check calls it.

### Anti-Pattern 2: Building three separate role-specific apps/shells

**What people do:** Literal `AgentApp`, `ManagerApp`, `OwnerApp` component trees that duplicate 90% of the same pages.
**Why it's wrong:** Triples maintenance for what's actually one page structure with varying visibility/permissions; a UI bug fix has to be applied three times, and the three shells silently drift.
**Instead:** One shell + one route tree, parametrized by scope (Pattern 1).

### Anti-Pattern 3: Treating the PDF endpoints like a normal navigable URL

**What people do:** `<a href="/api/rentals/:id/invoice.pdf">Télécharger</a>` expecting the browser to send the JWT.
**Why it's wrong:** Top-level navigations don't carry custom `Authorization` headers; this either 401s or requires falling back to insecure query-string tokens.
**Instead:** Pattern 4 (fetch-as-blob).

### Anti-Pattern 4: Uploading the photo and attaching it in one "optimistic" fire-and-forget call

**What people do:** Treat the two-step upload+attach as a single mutation, showing "saved" the moment the upload request is sent.
**Why it's wrong:** On flaky field connectivity, the attach call can fail after the upload succeeds (or vice versa), leaving an orphaned document or a damage record with a missing photo — and the UI already told the user it's saved.
**Instead:** Pattern 3's explicit per-step state machine, surfaced in the UI (spinner → "photo uploaded, saving..." → confirmed, or a clear retry affordance on failure).

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| `wheelio-api` (all modules) | REST + JSON, JWT Bearer auth, typed client in `shared/api/` | Single backend, contract is fixed per PROJECT.md — no backend changes possible from this project |
| `wheelio-api` documents endpoint | `multipart/form-data` POST returning `document_id` | Used both for inspection photos and (later, out of v1 scope) vehicle documents |
| `wheelio-api` PDF endpoints | `GET` returning `application/pdf` bytes, streamed, never cached | Consumed exclusively via Pattern 4; do not attempt client-side PDF generation/rendering |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `features/*` ↔ `features/*` | No direct imports between feature folders | If `rentals` needs a `customers` type, import from `shared/types`, not from `features/customers` internals — keeps features independently deletable/addable, matching the "core path first" delivery strategy |
| `features/*` ↔ `shared/api` | Feature `api.ts` calls the shared client, never `fetch`/`axios` directly | Keeps auth/refresh/error-normalization in one place |
| `app/shell` ↔ `shared/auth` | Shell reads `Scope` from the auth store to render nav; never re-implements role checks | Matches Anti-Pattern 1 avoidance |
| Route guards ↔ `shared/auth/permissions.ts` | Guards call the same permission functions used inline in pages | One source of truth end-to-end |

## Suggested Build Order (fastest path to v1 golden-path demo)

The core value in PROJECT.md is the single flow: **véhicule → client → contrat → état des lieux → clôture → facture PDF**. Architecture dependencies dictate this build order:

1. **Auth + shell + i18n scaffolding** — login, JWT storage, refresh interceptor (Pattern 2), route guards (Pattern 1), one `AppShell` with role-aware nav (even if nav has few items initially), fr/en i18n wiring. Nothing else can be demoed without this, and retrofitting auth/i18n onto existing screens is expensive — do it first and once.
2. **Fleet (vehicle list/detail, status, mileage)** — the simplest CRUD slice; proves out the data layer (TanStack Query hooks, query-key conventions, table/detail UI patterns) on low-complexity domain before tackling anything stateful like a contract lifecycle. Every later feature reuses these list/detail/form conventions.
3. **Customers (client + designated drivers)** — same CRUD shape as fleet, needed as a hard dependency for creating a contract (a rental needs a vehicle and a customer to exist first).
4. **Rentals (contract lifecycle: reserve → activate → close → cancel)** — the first genuinely stateful/workflow feature; depends on fleet + customers existing. This is where a status-machine UI pattern (reservation/active/closed/cancelled) is established, reused by inspections.
5. **Inspections (EDL sortie/retour, damage capture, photo upload)** — depends on an active contract existing. This is the highest-complexity slice (Pattern 3, mobile capture, sortie/retour comparison) — build it once contract state exists to attach inspections to, and once the upload/attach + PDF patterns are proven on simpler screens if possible (e.g., prove Pattern 4 on an invoice PDF button before wiring it into the inspection report PDF).
6. **Billing (invoice view, payment recording, avoir, PDF downloads)** — depends on a closed contract producing billing lines; this is also the first full exercise of Pattern 4 (PDF fetch-as-blob) unless pulled forward for validation.
7. **Company fiscal identity form (NIF/NIS/RC/forme juridique)** — required before invoice PDFs can be legally correct, but is a simple settings form; can be built in parallel with step 2-3 since it blocks step 6, not steps 2-5.

Rationale for this order: each step's data model is a hard prerequisite for the next (vehicle+customer → contract → inspection → invoice), and the "hardest" UI problems (two-step photo upload, authenticated PDF blob download) are deliberately pushed toward the end once the simpler CRUD/list/detail/form conventions (steps 2-3) and the workflow/status-machine convention (step 4) are already established — reducing the risk of building those hard patterns twice.

## Sources

- [Advanced React Routing: Route Guards](https://namastedev.com/blog/advanced-react-routing-implementing-custom-navigation-and-route-guards/) — route guard / layout composition patterns (web search, MEDIUM confidence)
- [React Router v7 authorization guide — WorkOS](https://workos.com/blog/react-router-v7-authorization-guide) — loaders/actions as independent security boundaries (web search, MEDIUM confidence)
- [React Router 7: Private Routes — Robin Wieruch](https://www.robinwieruch.de/react-router-private-routes/) — layout-route protection pattern (web search, MEDIUM confidence)
- [React Data Fetching Best Practices — TanStack Query](https://bluetickconsultants.medium.com/react-data-fetching-best-practices-why-tanstack-query-is-essential-for-scaling-5b83c958110d) — server-state caching architecture (web search, MEDIUM confidence)
- [React Query, Context API, and Axios Interceptors JWT Auth](https://codevoweb.com/react-query-context-api-axios-interceptors-jwt-auth/) — auth header + interceptor integration (web search, MEDIUM confidence)
- [How to auto-refresh JWTs using Axios interceptors — Lewis Kori](https://lewiskori.com/blog/how-to-auto-refresh-jwts-using-axios-interceptors/) — single-flight refresh + request queue pattern (web search, MEDIUM confidence)
- [Building a reusable multi-step form — React Hook Form + Zod — LogRocket](https://blog.logrocket.com/building-reusable-multi-step-form-react-hook-form-zod/) — per-step schema/form composition (web search, MEDIUM confidence)
- [Building An Offline-Friendly Image Upload System — Smashing Magazine (2025)](https://www.smashingmagazine.com/2025/04/building-offline-friendly-image-upload-system/) — per-file state machine, offline queue pattern (web search, MEDIUM confidence)
- [SaaS File Upload & Drag-and-Drop UX Patterns (2026)](https://www.saasui.design/blog/saas-file-upload-ux-patterns) — per-file progress/retry UX conventions (web search, MEDIUM confidence)
- [Authenticated File Downloads in React — The Daily Coder](https://blog.mellisdesigns.com/react-authenticated-file-downloads/) — fetch-as-blob download pattern, explains why `<a href>`/`window.open` fail with Bearer auth (web search, MEDIUM confidence)
- [Download files with AJAX (axios) — gist](https://gist.github.com/javilobo8/097c30a233786be52070986d8cdb1743) — blob URL + hidden anchor download implementation (web search, MEDIUM confidence)
- [React State Management in 2025: Zustand vs Redux vs Context — meerako](https://www.meerako.com/blogs/react-state-management-zustand-vs-redux-vs-context-2025) — client/server state separation rationale (web search, MEDIUM confidence)
- [Mastering Modern React + Vite Folder Structure](https://sandeshrathnayake.medium.com/mastering-modern-react-vite-folder-structure-a-production-ready-guide-for-scalable-applications-9ad8e233f8b9) — feature-based folder architecture (web search, MEDIUM confidence)
- [React Folder Structure Best Practices [2026] — Robin Wieruch](https://www.robinwieruch.de/react-folder-structure/) — feature-based vs type-based structuring (web search, MEDIUM confidence)

---
*Architecture research for: Role-based SaaS fleet-management dashboard frontend (Wheelio Front)*
*Researched: 2026-07-22*
