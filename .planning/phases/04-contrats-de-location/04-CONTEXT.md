---
phase: 4
slug: contrats-de-location
status: locked
created: 2026-07-28
mode: batch-continuation
note: >
  Continuous execution of phases 4-6. Decisions derived from prior phases,
  PROJECT.md, REQUIREMENTS, and the backend rental contract. Researcher MUST
  confirm every API-shape assumption against the Go source (rental_handler.go,
  rental_dto.go, domain/rental/contract.go + unavailability.go).
  USER DIRECTIVE (explicit, carried from project kickoff): the guided rental
  wizard (RENT-05) is a REAL, full version — "ça prendra le temps qu'il faut".
  No cut-corner MVP of the wizard.
---

# Phase 4 — Contexte : Contrats de location

## Requirements
RENT-01 (create reservation for available vehicle + customer; overlap rejected with friendly error, no silent double-booking), RENT-02 (activate: departure mileage + fuel level), RENT-03 (close: return mileage + fuel level + invoice lines), RENT-04 (cancel reservation or active contract with a recorded reason), RENT-05 (guided wizard vehicle→customer→contract→departure inspection as ONE continuous flow — full version), OPS-01 (today overview: pickups + returns due today, on landing).

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D-01 | Contract entity + statuses come from the backend enum (reserved/active/closed/cancelled — already mirrored in src/types/rental.ts phase 2). Reuse `contracts.status.*` i18n already shipped. Never invent statuses | Phase 2 continuity |
| D-02 | Contracts LIST at `/contrats` (replaces placeholder), dense table/cards, status filter + search, same pattern as fleet/customers. Columns: vehicle plate, customer, period, status | RENT visibility, phase 2/3 pattern |
| D-03 | Contract DETAIL at `/contrats/$contractId`: full contract card (vehicle, customer, period, status, deposit, departure/return mileage+fuel) + lifecycle action buttons gated by current status (activate if reserved, close if active, cancel if reserved/active) | RENT-02/03/04 |
| D-04 | Overlap rejection (RENT-01): the backend enforces an EXCLUDE constraint → returns a conflict (researcher confirms exact status/error shape). The UI maps that to a clear, friendly "ce véhicule est déjà réservé sur cette période" message — never a raw 409/500. Distinct i18n key | RENT-01 core value: no silent double-booking |
| D-05 | The GUIDED WIZARD (RENT-05) is the phase centerpiece — a multi-step flow on ONE screen route `/contrats/nouveau`: Step 1 pick/confirm vehicle (reuse fleet list, filter to available), Step 2 pick/create customer (reuse customer search + inline create), Step 3 contract terms (dates, deposit), Step 4 departure inspection handoff. Steps share state (a wizard store or RHF context), progress indicator, back/next, no full-page reloads between steps. Step 4 departure inspection: Phase 5 owns the full EDL; Phase 4 wires the handoff/stub with a clear seam. Researcher determines how much of departure capture the rental activate endpoint needs vs Phase 5 | RENT-05 (full version, user directive) |
| D-05a | Wizard state model: research decides between a dedicated Zustand wizard store vs a single RHF form with step-scoped validation. Must survive step navigation without losing entered data; must not persist across a full reload (fresh wizard each time) unless research shows the backend creates a draft contract early | Wizard integrity |
| D-06 | Lifecycle mutations (create/activate/close/cancel) via TanStack Query mutations over the shared api client; on success invalidate `["contracts", ...]` + the affected vehicle's `["vehicles", ...]` (status changes) | Phase 2/3 mutation pattern |
| D-07 | OPS-01 today overview: the `/` landing (currently placeholder EmptyState) becomes a dashboard listing today's pickups (reserved contracts starting today) + returns (active contracts ending today). Researcher confirms whether a dedicated endpoint exists or it's composed from the contracts list with date filters | OPS-01 |
| D-08 | Close (RENT-03) records invoice LINES. Phase 4 captures the return data + invoice-line entry that the close endpoint requires; the actual INVOICE document/compliance is Phase 6. Researcher clarifies what the close payload needs vs what Phase 6 adds | RENT-03 scope boundary with Phase 6 |
| D-09 | Role gating per backend Scope (rental handler authz — researcher confirms CanOperate vs agency-scoped). Contracts are agency-scoped (vehicle-linked) unlike customers — confirm | Backend authority |
| D-10 | All copy i18n FR+EN under `contracts.*` (extend the existing namespace) + new `wizard.*`/`ops.*` as needed, zero bare literals, FR/EN parity. Amounts in DZD, dates locale-formatted | AUTH-05/06 |
| D-11 | Data layer mirrors features/fleet + features/customers: `src/features/contracts/` (api, queries, mutations, screens, wizard). Reuse shared primitives + fleet/customer queries for the wizard's vehicle/customer pickers | Continuity |

## Scope fences
- Departure inspection FULL capture (photos, per-zone damage) is Phase 5 — Phase 4 wires the wizard handoff/seam only, capturing what the rental activate endpoint strictly requires.
- Invoice DOCUMENT + décret compliance + payments are Phase 6 — Phase 4 captures close-time return data + invoice lines the close endpoint needs.
- Replace `/contrats` and `/` (landing) placeholders. E2E regression: migrating `/` off placeholder + `/contrats` off placeholder will break phase-1/prior E2E placeholder assertions — a task MUST migrate them to a still-placeholder route (États des lieux) and keep all E2E green.

## Canonical references
- Backend source of truth: `/Users/azizbelkacemi/Desktop/work-dev/wheelio-api/internal/adapter/httpapi/rental_handler.go`, `rental_dto.go`, `internal/domain/rental/contract.go` + `unavailability.go` (overlap/EXCLUDE model, status transitions, activate/close/cancel payloads).
- Phase 2/3 conventions: `src/features/fleet/`, `src/features/customers/` (structure + wizard picker reuse), `src/shared/auth/permissions.ts` (hasOrgRole + canOperate — pick the right axis), existing `contracts.status.*` i18n, `src/types/rental.ts`.
- Types: extend `src/types/rental.ts` with create/activate/close/cancel request DTOs mirrored verbatim from the Go source.
