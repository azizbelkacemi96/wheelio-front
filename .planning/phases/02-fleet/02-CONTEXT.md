---
phase: 2
slug: fleet
status: locked
created: 2026-07-23
mode: batch-continuation
note: >
  User instructed continuous execution of phases 2-6 without per-phase
  discussion ("continue jusqu'à la fin"). Decisions below are derived from
  Phase 1's locked decisions (01-CONTEXT.md D-01..D-11), PROJECT.md, and the
  user's prior explicit choices — not newly invented.
---

# Phase 2 — Contexte : Fleet

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D-01 | Vehicle list = dense data table (desktop) degrading to stacked cards (<md), consistent with Phase 1's D-04 dense/compact choice | Counter staff scan many rows; mobile field use needs cards |
| D-02 | Live status displayed as colored Badge using existing design tokens (semantic colors), one color per backend status value — never invent client-side statuses | AUTH-03 principle: backend is the source of truth |
| D-03 | List columns: plate, brand/model, status, mileage, fuel level, agency (owner view). Filter: by status + text search on plate/brand/model. Client-side filtering acceptable if API has no query params; follow researcher's API findings | FLEET-01 scope, no invention |
| D-04 | Vehicle detail = dedicated route `/vehicules/$vehicleId` replacing the Phase 1 placeholder pattern; shows plate, brand/model, mileage, fuel, current status, current contract summary IF the API exposes it (researcher must confirm endpoint shape) | FLEET-02 |
| D-05 | Read-only phase: NO vehicle create/edit/delete UI in Phase 2 — the roadmap scopes only list + detail. Vehicle CRUD screens are out of scope (backend has them; UI defers) | Scope fence per ROADMAP |
| D-06 | Data fetching via TanStack Query with the shared `api` ky client; query keys namespaced `["vehicles", ...]`; agency scoping follows `currentAgencyId` from the auth store where the API is agency-scoped | Phase 1 architecture continuity |
| D-07 | All copy through i18n (FR default + EN), zero bare JSX literals — same Copywriting Contract as Phase 1 UI-SPEC | AUTH-05/AUTH-06 |
| D-08 | Role gating: list+detail visible to all roles (viewer and above) per backend Scope; no owner-only surface in this phase | Backend CanRead semantics |
| D-09 | Loading = skeleton rows; error = inline retry banner (same pattern as AppShell's); empty = EmptyState component from 01-07 | UI-state taxonomy, existing components |

## Scope fences

- NO vehicle creation/edit forms (defer; backend supports, UI out of v1 phase 2 scope).
- NO mileage-log UI, NO document upload UI (out of scope table in REQUIREMENTS.md).
- NO availability calendar (FLEET-03 is v2).
- Placeholder route `/vehicules` from 01-07 gets replaced by the real list screen.

## Canonical references

- Backend source of truth: `/Users/azizbelkacemi/Desktop/work-dev/wheelio-api/internal/adapter/httpapi/vehicle_handler.go` (endpoints + DTO shapes), `internal/domain/fleet/` (status enum values).
- Phase 1 conventions: `.planning/phases/01-foundations-auth-shell-i18n-design-system/01-UI-SPEC.md` (tokens, components, copywriting), `01-CONTEXT.md` (D-01..D-11).
- Types: extend `src/types/` with fleet DTOs mirrored from backend `dto.go` — same contract-fidelity discipline as identity.ts.
