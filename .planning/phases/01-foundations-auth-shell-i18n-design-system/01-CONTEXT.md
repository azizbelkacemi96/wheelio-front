# Phase 1: Foundations — Auth, Shell, i18n, Design System - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers: login with transparent JWT session refresh, a role-aware navigation shell (agent/manager/owner) driven entirely by the backend's `/me` scope, an owner-only agency switcher, French (default) + English i18n, and a bespoke design-token system + base component library. No feature screens (fleet/customers/rentals/etc.) are built here — this is the shell every later phase mounts into.

</domain>

<decisions>
## Implementation Decisions

### Identité visuelle
- **D-01:** Style reference is Stripe — colorful/gradient-friendly, "confident fintech" feel, not the neutral Linear/Notion look.
- **D-02:** Dark mode ships in v1, alongside light — both themes designed from the start via the design-token system, not retrofitted.
- **D-03:** Primary/accent color is blue (trust, standard for SaaS/automotive).
- **D-04:** UI density is dense/compact — favor more rows visible per screen (vehicle/contract tables) over generous whitespace; matches a front-desk agent working quickly at the counter.

### Connexion & session
- **D-05:** No password-reset flow in v1. The backend (`wheelio-api`) has zero reset-password endpoint (`/auth/signup`, `/login`, `/refresh`, `/logout` only) — building a real reset flow would require backend work that's out of scope for this project. Do not add even a fake/contact-link placeholder; simply omit it.
- **D-06:** Login errors are generic ("email ou mot de passe incorrect") for any failure — mirrors the backend's existing timing-equalizer anti-enumeration protection; never distinguish "unknown email" from "wrong password" client-side.
- **D-07:** A signup screen IS included in the front (not just an API curl call) — but it is a plain in-app screen, not a public marketing/self-serve site. This does not reopen the earlier "no self-serve signup" decision (PROJECT.md Out of Scope) — that exclusion was about a public-facing marketing/pricing site with self-serve onboarding; this is just a convenience screen for account creation, reachable like the login screen, not advertised.

### Navigation par rôle
- **D-08:** The base navigation (Aujourd'hui, Véhicules, Clients, Contrats, États des lieux) is identical for all three roles (agent/gérant/owner) — no role-based hiding within this base set. Fine-grained action permissions (create/edit/delete on specific records) are still gated per-action via the shared permission utility, independent of this nav-level decision.
- **D-09:** Three admin nav sections are owner-only and fully hidden (not just disabled) for agent/gérant: **Identité fiscale société**, **Gestion agences**, **Facturation transverse** (all-agency invoice view). This is a nav-section-visibility decision, distinct from D-08's per-action gating.

### Switch agence (owner)
- **D-10:** Agency switcher is a persistent top-bar dropdown (Slack/Linear-style) — always visible, one click, no dedicated page.
- **D-11:** Switching agency keeps the owner on their current section (e.g., staying on "Contrats" but now showing the newly selected agency's contracts) — never force a return to the dashboard/"Aujourd'hui" view on switch.

### Claude's Discretion
None flagged this round — every gray area surfaced had a concrete user decision.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stack & architecture (this project's own research)
- `.planning/research/STACK.md` — JWT storage tradeoff (access token in-memory, refresh in localStorage — the API returns both as plain JSON, no `Set-Cookie`), `<input capture="environment">` for photo capture, PDF-as-blob download pattern
- `.planning/research/ARCHITECTURE.md` — single-flight refresh interceptor pattern, one shared `permissions.ts` sourced from backend Scope, role-aware `AppShell` (not three separate apps), feature-module folder boundaries

### Backend API contract (sibling repo — read-only reference, do not modify)
- `/Users/azizbelkacemi/Desktop/work-dev/wheelio-api/internal/adapter/httpapi/auth_handler.go` — actual `/auth/signup`, `/login`, `/refresh`, `/logout`, `/me` request/response shapes; confirms no password-reset endpoint exists (D-05)
- `/Users/azizbelkacemi/Desktop/work-dev/wheelio-api/internal/domain/identity/scope.go` — `Scope.CanRead`/`CanOperate`/`CanManage`/`IsOrgAdmin` — this is the authoritative RBAC source the frontend's `permissions.ts` must mirror, never reimplement independently (per PROJECT.md constraint)

No formal SPEC.md/ADR exists for this phase — requirements are captured in REQUIREMENTS.md (AUTH-01..06) and the decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None yet — wheelio-front is greenfield, no code written before this phase.

### Established Patterns
- None yet in wheelio-front. The sibling `wheelio-api` repo's RLS/RBAC conventions (see canonical_refs) are the pattern source of truth for how roles/permissions must be interpreted, even though this is a separate frontend codebase.

### Integration Points
- Every API call in this phase goes through `wheelio-api`'s existing `/auth/*` and `/me` endpoints — no backend changes.

</code_context>

<specifics>
## Specific Ideas

- Visual direction: Stripe-like (colorful/gradient, confident fintech feel), blue primary accent, dense/compact tables, light+dark from day one.
- Agency switcher: top-bar dropdown, Slack/Linear-style, in-place context switch (no navigation reset).
- Nav: same base nav for every role; three owner-only admin sections (fiscal identity, agency management, cross-agency billing) hidden entirely for agent/gérant.

</specifics>

<deferred>
## Deferred Ideas

- **Password reset (self-service) flow** — requires a new backend endpoint on `wheelio-api` (out of scope for this frontend-only project). Revisit later as a backend-touching initiative, not a v1.x frontend phase.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 1-Foundations — Auth, Shell, i18n, Design System*
*Context gathered: 2026-07-22*
