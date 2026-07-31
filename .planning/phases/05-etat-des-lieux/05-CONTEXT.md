---
phase: 5
slug: etat-des-lieux
status: locked
created: 2026-07-29
mode: batch-continuation
note: >
  Continuous execution. Decisions derived from prior phases, PROJECT.md,
  REQUIREMENTS, and the backend inspection contract. Researcher MUST confirm
  every API-shape assumption against the Go source (inspection_handler.go,
  inspection_dto.go, internal/domain/inspection/). The Phase 4↔5 seam is
  already wired: the rental wizard's StepDeparture captures ONLY mileage+fuel
  and marks a data-phase="5-inspection-handoff" card where the full état des
  lieux slots in.
---

# Phase 5 — Contexte : État des lieux (inspections)

## Requirements
INSP-01 (departure/sortie inspection: mileage, fuel level, damage per canonical zone), INSP-02 (on-site photo capture on mobile/tablet, attached to a recorded damage, RESILIENT to flaky field connectivity — incremental upload, automatic retry, no silent loss), INSP-03 (return/retour inspection, same zone-based damage entry).

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D-01 | Inspection is tied to a rental contract (departure = at activation, return = at close). Entry points: from the contract detail (04-03) and, for departure, optionally continued from the wizard's Phase-5 seam. Researcher confirms the exact contract↔inspection linkage + whether departure inspection must precede/accompany activate | INSP-01/03, Phase 4 seam |
| D-02 | Canonical vehicle ZONES come from the backend enum (front bumper, doors, roof, etc.) — render the exact zone set + i18n labels, never a client-invented list. Damage entry is per-zone: select zone → describe damage → (optional) attach photo(s) | INSP-01, compliance fidelity |
| D-03 | Damage record shape (type/severity/description) mirrors the backend DTO verbatim. Researcher lists every enum (damage type, severity) with exact values | INSP-01 |
| D-04 | PHOTO CAPTURE (INSP-02, the hard part): use the native file/camera input (`<input type="file" accept="image/*" capture="environment">`) for on-site mobile capture — no native app. Upload is RESILIENT: each photo uploads independently (incremental), a failed upload auto-retries with backoff, in-progress state is visible per photo, and nothing is silently lost. Model as an explicit per-photo upload state machine (queued→uploading→uploaded→failed→retrying). Researcher confirms the upload endpoint (multipart? presigned URL? direct to inspection/damage?), size limits, and whether the backend supports resumable/chunked or just whole-file | INSP-02 — the phase's core value + hardest technical risk |
| D-05 | Upload-then-attach pattern (like Phase 3 create-then-attach discipline): a photo is uploaded, then attached to a specific damage; partial failure (photo uploaded, attach failed, or vice-versa) is surfaced and retryable, never a silent orphan. Researcher confirms if upload+attach is one call or two | INSP-02 resilience |
| D-06 | Offline/flaky resilience scope for v1: automatic retry with backoff + visible per-photo status + no data loss on a dropped request. FULL offline queue persistence across a page reload is a stretch goal — researcher assesses feasibility vs the backend; if the backend has no resumable upload, bound v1 to in-memory retry + explicit "retry failed uploads" affordance (still "no silent loss") | INSP-02 realistic bound |
| D-07 | Return inspection (INSP-03) reuses the SAME zone-based damage + photo components as departure, differing only in which contract phase it attaches to and the mileage/fuel captured. Do NOT build two parallel UIs | INSP-03, DRY |
| D-08 | Responsive/mobile-first for the capture screens specifically (field use on a phone/tablet at the vehicle) — larger touch targets, camera-friendly, works one-handed. The rest of the app stays desktop-dense (Phase 1 D-04); the inspection capture is the one screen tuned for the field | INSP-02 "on-site, responsive" |
| D-09 | Role gating: agency-scoped via the contract's vehicle (canOperate(scope, vehicle.agency_id)) — same axis as rentals, NOT hasOrgRole | Backend authority |
| D-10 | All copy i18n FR+EN under new `inspections.*` namespace, zero bare literals, FR/EN parity. Data layer mirrors features/contracts: src/features/inspections/ | AUTH-05/06, continuity |
| D-11 | The INSP-04 departure-vs-return comparison view is v2 (deferred) — do NOT build it | Scope fence |

## Scope fences
- NO side-by-side departure/return damage comparison (INSP-04 is v2).
- NO native mobile app — responsive web camera input only.
- Invoice/PDF of the inspection report is Phase 6 (BILL-05) — Phase 5 captures the data; Phase 6 does the authenticated PDF download.
- Replace the `/etats-des-lieux` placeholder route with the real inspection entry (list of inspectable contracts, or reached from contract detail — researcher/plan decides the entry topology).

## Canonical references
- Backend source of truth: `/Users/azizbelkacemi/Desktop/work-dev/wheelio-api/internal/adapter/httpapi/inspection_handler.go`, `inspection_dto.go`, `internal/domain/inspection/` (zones enum, damage type/severity enums, photo/upload model, contract linkage).
- Phase 4 seam: `src/features/contracts/wizard/StepDeparture.tsx` (the data-phase="5-inspection-handoff" card), `src/features/contracts/ContractDetail.tsx` (lifecycle actions — where an "inspection" action may live).
- Phase 3 upload-adjacent discipline: `src/features/customers/mutations.ts` (create-then-attach partial-failure pattern to mirror for upload-then-attach).
- Types: add `src/types/inspection.ts` mirrored verbatim from the Go DTO.
