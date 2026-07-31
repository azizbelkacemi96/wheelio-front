# Phase 5: État des lieux (inspections) - Research

**Researched:** 2026-07-29
**Domain:** Zone-based damage capture + resilient on-site photo upload (React 19 / TanStack Query / ky / MSW), against the wheelio-api inspection + document modules
**Confidence:** HIGH (backend contract read verbatim from Go source; frontend patterns read from the live codebase)

## Summary

The backend contract is already built and read verbatim below. Two facts reshape the plan relative to CONTEXT's assumptions and must be treated as locked:

1. **There is NO dedicated inspection-photo upload endpoint.** A photo is uploaded to the existing **documents** module (`POST /vehicles/:vehicleID/documents`, multipart, whole-file, ≤20 MB) which returns a `document_id`; that id is then attached to a damage via `POST /inspection-damages/:damageID/photos` with `{ "document_id": "..." }` → `204`. So the "upload-then-attach" pattern from Phase 3 is not just an analogy — it is literally two HTTP calls, exactly the customers create-then-attach discipline. `[VERIFIED: inspection_handler.go:96-109, inspection_dto.go:33-37, server.go:92/148]`

2. **The backend enforces a hard gate at validation: every recorded damage must have ≥1 attached photo, or `POST /inspections/:id/validate` returns `400 "every damage requires at least one photo before closing"`.** `[VERIFIED: usecase/inspection/service.go:233-241]` This makes the resilient photo pipeline not a nice-to-have but a completion blocker — the whole inspection cannot be closed until every damage's photo has successfully uploaded AND attached. The UI must surface per-damage photo state and disable/explain the Validate action accordingly.

Photo upload is whole-file only — **no resumable or chunked support exists** (documents `Upload` buffers the entire file: `io.ReadAll(io.LimitReader(...))`). `[VERIFIED: usecase/document/service.go:101-109]` This bounds v1 resilience to in-memory automatic-retry-with-backoff + visible per-photo status + a manual "retry failed" affordance — which fully satisfies "no silent loss" (D-06). Full offline persistence across reload is correctly deferred.

**Primary recommendation:** Build one shared zone-based damage + photo capture feature under `src/features/inspections/`, reused by departure and return (D-07). Model each photo as an explicit per-photo state machine (`queued → compressing → uploading → uploaded → attaching → attached | failed`) driven at the application/mutation layer (fresh `FormData` per attempt, NOT ky's internal retry), with client-side canvas downscale before upload. **Zero new npm packages** — native `File`/`<input capture>`/canvas + the existing `ky` client + TanStack Query cover everything.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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

### Claude's Discretion
- Entry topology for the `/etats-des-lieux` route (list of inspectable contracts vs reached from contract detail) — researcher/plan decides.

### Deferred Ideas (OUT OF SCOPE)
- NO side-by-side departure/return damage comparison (INSP-04 / the `/compare` endpoint is v2).
- NO native mobile app — responsive web camera input only.
- Invoice/PDF of the inspection report is Phase 6 (BILL-05).
- FULL offline queue persistence across page reload (stretch, deferred to keep v1 bounded).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INSP-01 | Departure (sortie) inspection: mileage, fuel level, damage entered per canonical vehicle zone | `POST /rental-contracts/:contractID/inspections` (kind=departure) + `POST /inspections/:id/damages`; exact zone/type/severity enums below; reuse `FUEL_LEVELS` from wizard schema |
| INSP-02 | On-site photo capture on mobile/tablet, attached to a recorded damage, RESILIENT to flaky connectivity (incremental upload, automatic retry, no silent loss) | Two-step upload (`POST /vehicles/:vehicleID/documents`) → attach (`POST /inspection-damages/:damageID/photos`); per-photo state machine + canvas compression + app-layer backoff retry; whole-file only (no chunked) |
| INSP-03 | Return (retour) inspection, same zone-based damage entry | `POST /rental-contracts/:contractID/inspections` (kind=return) — requires a **validated** departure inspection first (409 otherwise); reuse the SAME components (D-07) |
</phase_requirements>

## Project Constraints (from CLAUDE.md / prior phases)

- **Single ky client only** — every request goes through `src/shared/api/client.ts` (`api`), inheriting the `/v1` prefix and the single-flight refresh interceptor. NEVER instantiate a second HTTP client. `[VERIFIED: contracts/api.ts:12, client.ts:111]`
- **Zero bare literals** — all copy under `inspections.*` in `src/shared/i18n/{fr,en}/common.json` (single `common` namespace, nested keys — there is no per-file namespace loading). FR is the hard default; FR/EN parity required. `[VERIFIED: i18n/index.ts:23-30]`
- **`encodeURIComponent` every id** interpolated into a request path (threat mirrors customers/contracts `encodeIdSegment`). `[VERIFIED: contracts/api.ts:33-35]`
- **canOperate on the VEHICLE's agency_id**, never the contract's — the contract response has no `agency_id`; fetch the vehicle for the gate. `[VERIFIED: ContractDetail.tsx:106-108, permissions.ts:61]`
- **Data layer mirrors `features/contracts/`**: `api.ts` (thin ky calls), `queries.ts` (TanStack useQuery), `mutations.ts` (useMutation), colocated `*.test.tsx`. Types in `src/types/inspection.ts` mirrored verbatim from the Go DTO.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Create/validate inspection, record damage, attach photo | API / Backend | — | All business rules, RLS, the "every damage needs a photo" gate, and the return→available/maintenance side-effects live in `inspectionuc.Service`; the client only orchestrates calls |
| Photo bytes storage + content-type sniffing + EXIF | API / Backend (documents module) | — | Whole-file buffer, real-byte sniff, size cap, storage all in `documentuc.Service`; client cannot bypass |
| Per-photo upload state machine, retry/backoff, queue | Browser / Client | — | Resilience to flaky links is a client concern; backend is stateless whole-file |
| Client-side image downscale/compress | Browser / Client | — | Canvas re-encode before upload; reduces bytes on the wire to survive flaky links |
| On-site camera capture | Browser / Client | — | `<input capture>` native camera; no server involvement |
| Agency-scope authorization gate (UI affordance) | Browser / Client | API / Backend | Client hides actions via `canOperate(vehicle.agency_id)`; backend re-enforces (403/404) — defense in depth |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ky` | 2.0.2 (installed) | HTTP incl. multipart upload via `body: FormData` | The one shared client; already carries auth + refresh `[VERIFIED: package.json, client.ts]` |
| `@tanstack/react-query` | 5.101.4 (installed) | Server-state, `useMutation` for create/attach/validate, `useQuery` for get/list | Established pattern across every feature `[VERIFIED: package.json]` |
| `react-hook-form` + `zod` | installed | Damage form (zone/type/severity/description) validation | Same as wizard/customers forms `[VERIFIED: StepDeparture.tsx uses useFormContext]` |
| Native `File` + `<input type="file" capture>` + Canvas | Web platform | On-site capture + client-side downscale/compress | D-04 mandates native input, no native app; zero dependency |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `msw` | 2.15.0 (installed) | Mock inspection + document-upload endpoints in vitest, incl. fail-then-succeed upload | All unit/integration tests |
| `@playwright/test` | 1.61.1 (installed) | E2E; must be updated for the last-placeholder migration | e2e/auth.spec.ts + a new inspection e2e (optional) |
| `i18next` / `react-i18next` | installed | `inspections.*` copy | All UI strings |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| App-layer retry with fresh FormData | ky built-in `retry` on POST | ky's forced-retry reconstructs the `Request`; a consumed multipart body is fragile to replay, and ky retry gives no backoff/visible-status hooks. App-layer wins for a visible state machine. |
| In-memory queue (v1) | IndexedDB-persisted queue (`idb-keyval`) | Backend has no resumable upload; persisting a `File` across reload is high-complexity for a short at-the-vehicle session. Deferred (D-06). Not worth a dependency in v1. |
| Canvas `toBlob` compression | `browser-image-compression` npm | The one-file canvas helper below is ~30 lines and zero-dep; a package is unjustified. |

**Installation:** _None._ No new runtime or dev dependency is required for Phase 5.

## Package Legitimacy Audit

No external packages are introduced in this phase. Every capability is met by the web platform or already-installed dependencies (`ky`, `@tanstack/react-query`, `react-hook-form`, `zod`, `msw`, `i18next`). The Package Legitimacy Gate is therefore **N/A** — there is nothing to audit.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Backend API Contract (verbatim — file:line)

All routes are under the `/v1` prefix and require Bearer auth (the `authed` group). `[VERIFIED: server.go:141-148, 92-99]`

### Inspection + damage + photo endpoints

| Method | Path | Handler | Request DTO | Success | Authz |
|--------|------|---------|-------------|---------|-------|
| POST | `/rental-contracts/:contractID/inspections` | CreateInspection `[handler.go:25]` | `createInspectionRequest` | `201` `inspectionResponse` | write → `CanOperate(vehicle.agency_id)` |
| GET | `/inspections/:inspectionID` | GetInspection `[handler.go:45]` | — | `200` `inspectionResponse` | read → `CanRead` |
| POST | `/inspections/:inspectionID/damages` | RecordDamage `[handler.go:59]` | `recordDamageRequest` | `201` `damageResponse` | write → `CanOperate`; inspection must be `draft` (409 if validated) |
| GET | `/inspections/:inspectionID/damages` | ListDamages `[handler.go:82]` | — | `200` `[]damageResponse` | read → `CanRead` |
| POST | `/inspection-damages/:damageID/photos` | AttachPhoto `[handler.go:96]` | `attachPhotoRequest` | **`204 No Content`** | write → `CanOperate`; inspection must be `draft` |
| POST | `/inspections/:inspectionID/validate` | Validate `[handler.go:113]` | — | `200` `inspectionResponse` | write → `CanOperate`; **gate: every damage needs ≥1 photo** |
| GET | `/rental-contracts/:contractID/inspections/compare` | Compare `[handler.go:127]` | — | `200` `compareResponse` | read — **DEFERRED (INSP-04, D-11), do NOT call** |

### Photo document upload endpoint (documents module — this is where a photo's bytes go)

| Method | Path | Handler | Request | Success | Notes |
|--------|------|---------|---------|---------|-------|
| POST | `/vehicles/:vehicleID/documents` | documentHandler.Upload `[document_handler.go:85]` | **multipart/form-data** | `201` `documentResponse` | This produces the `document_id` you attach. See fields below. |

**Multipart form fields** `[VERIFIED: document_handler.go:90-122]`:
- `file` — **required** (the image bytes). Missing → `400 "multipart field 'file' is required"`.
- `type` — **required**, must be a valid document type. For inspection photos use **`other`**. Invalid → `400`. Valid set: `registration_card, insurance, technical_inspection, rental_contract, invoice, other` `[VERIFIED: document_handler.go:96-98]`.
- `title` — optional (defaults to the filename).
- `issued_at`, `expires_at` — optional dates (not relevant for a photo; omit).

**Upload constraints** `[VERIFIED: usecase/document/service.go]`:
- **Max size: 20 MB** (`MAX_UPLOAD_MB` default 20 → `20*1024*1024`). Over → `400 "file exceeds the 20 MB limit"`. `[config.go:22, main.go:95, service.go:106-108]`
- **Allowed content types, sniffed from real bytes (declared Content-Type ignored):** `image/jpeg`, `image/png`, `image/webp` (also `application/pdf`, irrelevant here). Anything else → `400 "unsupported file type (allowed: pdf, jpeg, png, webp)"`. `[service.go:28-33, 113-117]` **HEIC (iPhone) is NOT allowed** — see Pitfall 7.
- **Whole-file only** — `io.ReadAll(io.LimitReader(content, maxBytes+1))`. No chunked/resumable. `[service.go:102]`
- JPEG EXIF (`taken_at`, GPS) extracted best-effort, never blocking `[service.go:128-130]`. Lost if you canvas-re-encode (see Pitfall 7 tradeoff).

### Request DTOs (verbatim JSON) `[VERIFIED: inspection_dto.go]`

```jsonc
// createInspectionRequest  [inspection_dto.go:16-20]
{
  "kind":    "departure" | "return",                 // required, oneof
  "mileage": 0,                                        // int, gte=0
  "fuel":    "empty"|"quarter"|"half"|"three_quarters"|"full"  // required, oneof
}

// recordDamageRequest  [inspection_dto.go:25-31]
{
  "zone":        "front_bumper"|"rear_bumper"|"door_fl"|"door_fr"|"door_rl"|"door_rr"|"hood"|"roof"|"windshield"|"wheels", // required, oneof
  "damage_type": "scratch"|"dent"|"crack"|"broken",   // required, oneof
  "severity":    "minor"|"moderate"|"severe",         // required, oneof
  "position":    "",                                   // optional free string
  "description": ""                                    // optional free string
}

// attachPhotoRequest  [inspection_dto.go:35-37]
{ "document_id": "uuid" }                              // required
```

### Response DTOs (verbatim JSON) `[VERIFIED: inspection_dto.go:41-63, document_handler.go:27-42]`

```jsonc
// inspectionResponse
{
  "id": "uuid", "contract_id": "uuid", "agency_id": "uuid",
  "kind": "departure|return", "status": "draft|validated",
  "mileage": 0, "fuel_level": "empty|quarter|half|three_quarters|full",
  "validated_at": "RFC3339 | omitted", "created_at": "RFC3339", "updated_at": "RFC3339"
}

// damageResponse   — NOTE: NO photos field. There is no way to read a damage's photos back.
{
  "id": "uuid", "inspection_id": "uuid",
  "zone": "...", "damage_type": "...", "severity": "...",
  "position": "omitempty", "description": "omitempty", "created_at": "RFC3339"
}

// documentResponse (from the upload) — you need `id` (= the document_id to attach)
{ "id": "uuid", "vehicle_id": "uuid", "type": "other", "title": "...",
  "content_type": "image/jpeg", "size_bytes": 0, "sha256": "...",
  "created_at": "RFC3339", "taken_at": "omitempty", "gps_latitude": null, "gps_longitude": null, ... }
```

> **Note — `inspectionResponse.agency_id` IS present** (unlike the rental contract response, which lacks it). But you STILL need the vehicle for the upload endpoint's `vehicle_id` (see linkage below) and can reuse the contract's `vehicle_id`.

## Enums (exact values — render these, never a client-invented list) `[VERIFIED: domain/inspection]`

| Enum | Exact values | Source |
|------|-------------|--------|
| **Zone** (10) | `front_bumper`, `rear_bumper`, `door_fl`, `door_fr`, `door_rl`, `door_rr`, `hood`, `roof`, `windshield`, `wheels` | `damage.go:17-27` |
| **DamageType** (4) | `scratch`, `dent`, `crack`, `broken` | `damage.go:41-46` |
| **Severity** (3) | `minor`, `moderate`, `severe` | `damage.go:60-64` |
| **Kind** (2) | `departure`, `return` | `inspection.go:20-23` |
| **Status** (2) | `draft`, `validated` | `inspection.go:36-39` |
| **FuelLevel** (5) | `empty`, `quarter`, `half`, `three_quarters`, `full` | reuse `FUEL_LEVELS` from `contracts/wizard/schema.ts` `[VERIFIED: StepDeparture.tsx:19]` |

Define these as `as const` arrays in `src/types/inspection.ts` and drive both the zod schema `oneof` and the UI option lists from them (never duplicate). i18n label keys: `inspections.zone.<value>`, `inspections.damageType.<value>`, `inspections.severity.<value>` (fuel labels already exist at `vehicles.fuelLevel.<value>` — reuse).

## The EXACT photo capture → upload → attach call sequence

This is the phase's core flow. It is **two HTTP calls per photo**, mirroring customers create-then-attach `[VERIFIED: customers/mutations.ts]`.

```
Precondition: a damage row exists (POST /inspections/:id/damages returned a damage.id),
and you know the contract's vehicle_id (from the contract response).

Per captured photo:
  1. (client) compress: File --canvas--> Blob (JPEG q≈0.8, longest edge ≤1600px)
  2. UPLOAD:  POST /vehicles/{vehicleId}/documents   (multipart)
                fields: file=<blob>, type="other", title="inspection-<damageId>.jpg"
              --> 201 documentResponse { id: <documentId>, ... }
  3. ATTACH:  POST /inspection-damages/{damageId}/photos
                json: { "document_id": <documentId> }
              --> 204 No Content
  4. photo state -> "attached"

Partial-failure discipline (D-05):
  - If step 2 fails: no document_id yet -> retry the WHOLE step (compress cached, re-upload).
  - If step 2 succeeded but step 3 fails: KEEP the documentId, retry ONLY step 3.
    Never re-upload (that would create a second orphan vehicle document).
  - A photo is only "attached" (green) after the 204. Anything else stays visibly
    "failed / retryable" — never silently dropped.
```

`AttachPhoto` does **not** validate that the document is an image or belongs to the vehicle — it is a pure link `[VERIFIED: service.go:152-169]`. So the two calls are independent; the only coupling you enforce is client-side (don't attach a `document_id` you didn't just get).

**No photo readback.** `damageResponse` has no photos array and there is no list-photos endpoint (`HasPhoto` is internal-only, used only by the Validate gate) `[VERIFIED: inspection_dto.go:54-63, service.go:234]`. Consequence: the client is the **only** place that knows a damage's photos during a capture session. Display previews from `URL.createObjectURL(file)` locally; do NOT try to re-fetch them. (If a persisted photo ever needs rendering later, `GET /documents/:id/download-url` returns a short-lived signed URL usable as `<img src>` — but that is not needed in this phase.)

## Contract ↔ inspection linkage (confirmed)

`[VERIFIED: usecase/inspection/service.go, domain/inspection/inspection.go:1-4]`

- **An inspection is created against a contract:** `POST /rental-contracts/:contractID/inspections`. The response carries `contract_id`, `agency_id`, and mileage/fuel.
- **Inspection status is DECOUPLED from contract status by design** — domain comment: *"Le statut de l'inspection n'est jamais couplé au statut du contrat de location."* `[inspection.go:1-4]` A departure inspection does **not** gate, precede, or accompany `activate`. Phase 4's `activate` already took only mileage+fuel independently; the full état des lieux is a **separate parallel record** attached to the same contract. The wizard seam card (`data-phase="5-inspection-handoff"`) just marks where the UI continues — it posts no inspection data.
- **Return requires a VALIDATED departure:** creating `kind=return` when no `departure` inspection exists (or it isn't `validated`) → `409 "a validated departure inspection is required before creating a return inspection"` `[service.go:82-93]`. Surface this precondition in the UI (offer "return" only once a validated departure exists).
- **Validating a RETURN inspection triggers backend side-effects** (client just POSTs validate): vehicle → `available`, mileage recorded, and a maintenance intervention auto-created for each new/worse damage vs departure `[service.go:249-273]`. The client does not orchestrate these.
- **`vehicle_id` for the photo upload** comes from the contract response (`contractResponse.vehicle_id` `[rental_dto.go:85]`). The `agency_id` for the `canOperate` gate is NOT on the contract — fetch the vehicle (as `ContractDetail.tsx` already does) `[ContractDetail.tsx:106-108]`.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────── Inspection Capture Screen (mobile-first) ──────────────────────┐
 Contract detail    │                                                                                        │
  "État des lieux"  │  [mileage] [fuel]  →  Create Inspection ──POST /rental-contracts/:id/inspections──▶ 201 (draft)
   action  ───────▶ │                                                                                        │
                    │  Per zone:  select zone → type/severity/desc → Record Damage ──POST /inspections/:id/damages──▶ 201 damage.id
                    │                                                                                        │
                    │  For that damage: capture photo(s) ─┐                                                  │
                    │   <input capture="environment">     │  each photo = independent state machine          │
                    │                                     ▼                                                  │
                    │   File ─canvas compress─▶ Blob ─▶ [queued→uploading] ─POST /vehicles/:vid/documents─▶ 201 document_id
                    │                                       │                    (retry w/ backoff on fail)  │
                    │                                       ▼                                                 │
                    │                                  [attaching] ─POST /inspection-damages/:did/photos─▶ 204 [attached]
                    │                                       │  (retry ONLY this step on fail — keep doc id)  │
                    │                                       ▼                                                 │
                    │  When every damage has ≥1 attached photo:  Validate ──POST /inspections/:id/validate──▶ 200 (validated)
                    │                                            (400 if any damage has no photo — gate)      │
                    └────────────────────────────────────────────────────────────────────────────────────────┘
                       All calls via the single `api` (ky) client → /v1 → auth + single-flight refresh
```

### Recommended Project Structure
```
src/features/inspections/
├── api.ts                    # thin ky calls: createInspection, getInspection,
│                             #   recordDamage, listDamages, uploadPhotoDocument,
│                             #   attachPhoto, validateInspection
├── queries.ts                # useInspectionQuery, useDamagesQuery
├── mutations.ts              # useCreateInspectionMutation, useRecordDamageMutation,
│                             #   useValidateInspectionMutation
├── upload/
│   ├── photoUploadMachine.ts # per-photo state machine (pure, testable)
│   ├── useDamagePhotos.ts    # hook: manages a damage's photo list + retry/backoff
│   └── compressImage.ts      # canvas downscale/compress (zero-dep)
├── InspectionScreen.tsx      # orchestrator (shared by departure & return, D-07)
├── ZoneDamageEntry.tsx       # zone select + damage form
├── DamagePhotoCapture.tsx    # <input capture> + per-photo thumbnails/status/retry
└── *.test.tsx
src/types/inspection.ts       # enums (as const) + DTO types mirrored from Go
src/routes/_authenticated/etats-des-lieux.tsx   # replace placeholder (see entry topology)
```

### Pattern 1: Per-photo upload state machine (the resilience core)
**What:** each photo is an object with an explicit status; transitions are driven by the two-call sequence with app-layer bounded backoff retry.
**When to use:** every captured photo.

```typescript
// photoUploadMachine.ts — pure, unit-testable, no React
export type PhotoStatus =
  | "queued" | "compressing" | "uploading" | "uploaded"
  | "attaching" | "attached" | "failed";

export interface PhotoItem {
  id: string;              // client-side uuid (crypto.randomUUID())
  file: File;
  previewUrl: string;      // URL.createObjectURL(file) — revoke on removal
  status: PhotoStatus;
  documentId?: string;     // set after a successful upload; retry-attach reuses it
  attempts: number;        // bounded (e.g. 3 auto attempts)
  error?: string;          // last error message, surfaced in the UI
}

const MAX_AUTO_ATTEMPTS = 3;
const backoffMs = (attempt: number) =>
  Math.min(1000 * 2 ** attempt, 8000) + Math.random() * 250; // jitter
```

```typescript
// useDamagePhotos.ts (sketch) — drives one damage's photos independently
async function runPhoto(p: PhotoItem, damageId: string, vehicleId: string, set: Setter) {
  try {
    // Step 1: compress once (skip if a documentId already exists = attach-only retry)
    let documentId = p.documentId;
    if (!documentId) {
      set(p.id, { status: "compressing" });
      const blob = await compressImage(p.file);          // canvas → JPEG
      set(p.id, { status: "uploading" });
      // FRESH FormData every attempt (never reuse a consumed body):
      const doc = await uploadPhotoDocument(vehicleId, blob, p.file.name); // 201
      documentId = doc.id;
      set(p.id, { status: "uploaded", documentId });
    }
    // Step 2: attach (retry-only path lands here directly)
    set(p.id, { status: "attaching" });
    await attachPhoto(damageId, documentId);             // 204
    set(p.id, { status: "attached" });
  } catch (err) {
    const next = p.attempts + 1;
    if (next < MAX_AUTO_ATTEMPTS) {
      set(p.id, { status: p.documentId ? "uploaded" : "queued", attempts: next, error: msg(err) });
      await sleep(backoffMs(next));
      return runPhoto({ ...p, attempts: next }, damageId, vehicleId, set); // auto-retry
    }
    set(p.id, { status: "failed", attempts: next, error: msg(err) }); // visible, manual retry
  }
}
```
Multiple photos call `runPhoto` concurrently (bound to ~2-3 in flight) so they progress **independently** — a success criterion. A manual "Retry" button on a `failed` photo resets `attempts` and re-invokes `runPhoto` (attach-only if `documentId` is set).

### Pattern 2: Multipart upload through the shared ky client
```typescript
// api.ts
export function uploadPhotoDocument(vehicleId: string, blob: Blob, filename: string) {
  const form = new FormData();
  form.append("file", blob, filename);
  form.append("type", "other");                 // required valid doc type
  form.append("title", `inspection-${filename}`);
  return api
    .post(`vehicles/${encodeURIComponent(vehicleId)}/documents`, {
      body: form,          // NEVER set Content-Type manually (browser sets the boundary)
      timeout: 60_000,     // override ky's 10s default — a photo on 3G needs headroom
    })
    .json<DocumentResponse>();
}

export async function attachPhoto(damageId: string, documentId: string): Promise<void> {
  await api.post(`inspection-damages/${encodeURIComponent(damageId)}/photos`, {
    json: { document_id: documentId },
  }); // 204 — do NOT call .json()
}
```

### Pattern 3: Client-side image compression (zero-dep)
```typescript
// compressImage.ts
export async function compressImage(file: File, maxEdge = 1600, quality = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(file);          // decodes JPEG/PNG/WebP/HEIC-if-supported
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("compress failed"))), "image/jpeg", quality),
  );
}
```
This also **normalizes HEIC/PNG/WebP to JPEG** (a backend-allowed type) and slashes 3-12 MB phone photos to ~300-800 KB — the single highest-leverage move for surviving flaky links.

### Anti-Patterns to Avoid
- **Relying on ky's built-in `retry` for uploads.** Its forced retry reconstructs the `Request`; a multipart body is fragile to replay and you get no backoff/visible status. Retry at the app layer with a fresh `FormData`.
- **Setting `Content-Type: multipart/form-data` manually.** The browser must set the boundary; passing `body: FormData` to ky already does the right thing. A manual header breaks parsing.
- **Coupling inspection availability to contract status.** They are decoupled by design — gate on `canOperate` + inspection `draft`, not on contract lifecycle.
- **Building a second HTTP client** for uploads. Use the shared `api`.
- **Re-uploading on attach-failure.** Keep the `document_id` and retry only the attach (avoids orphan documents).
- **Calling `/compare`** — it's INSP-04, deferred (D-11).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth + refresh on upload | A bespoke fetch with token handling | The shared `api` (ky) client | Single-flight refresh already solved; a second client races theft detection |
| Image resize/compress | A manual pixel loop / a new npm pkg | `createImageBitmap` + canvas `toBlob` | ~30 lines, zero-dep, GPU-accelerated decode |
| Retry/backoff plumbing across the app | A global retry lib | The per-photo machine above | Resilience must be per-photo + visible, not a blanket wrapper |
| Chunked/resumable upload | A tus/multipart-chunk client | Whole-file + compression | Backend has NO resumable endpoint; chunking is impossible server-side |
| Multipart body construction | String-building a boundary | Native `FormData` | Browser handles encoding + boundary |

**Key insight:** the backend already owns every hard invariant (sizes, sniffing, the photo gate, the return side-effects). The only genuinely new engineering in this phase is the **client-side resilience layer** — and its correct scope is "make two calls per photo survive a flaky link with visible status," nothing more.

## Runtime State Inventory

Not applicable — this is a greenfield frontend feature (new components, new route content, new types). No rename/refactor/migration of stored data, service config, OS-registered state, secrets, or build artifacts. The only pre-existing state touched is the `/etats-des-lieux` placeholder route and the two test files that assert it (see Pitfall 8).

## Common Pitfalls

### Pitfall 1: Upload timeout vs the refresh interceptor
**What goes wrong:** ky's default `timeout` is 10 s; a multi-MB photo on a 3G/flaky link exceeds it and aborts. Separately, if a 401 fires mid-upload, the refresh interceptor's forced retry rebuilds the `Request` around a multipart body that may already be consumed.
**How to avoid:** override `timeout: 60_000` on the upload call; do all resilience retries at the app layer with a **fresh** `FormData` each attempt (never rely on the interceptor to replay the body). Compression (Pitfall-adjacent) shrinks the payload so timeouts are rarely hit.
**Warning signs:** `TimeoutError` on large files; a second upload succeeding where the first "hung."

### Pitfall 2: Manual Content-Type on FormData
**What goes wrong:** setting `Content-Type: multipart/form-data` (without the generated boundary) makes the server fail to parse `file`, yielding `400 "multipart field 'file' is required"`.
**How to avoid:** pass `body: form` to ky and set nothing; the browser adds the boundary.

### Pitfall 3: Large images / HEIC content-type rejection
**What goes wrong:** raw phone photos can exceed 20 MB → `400`; iPhone HEIC (`image/heic`) is not in the allowed set → `400 "unsupported file type"`.
**How to avoid:** always run `compressImage` (canvas → JPEG) before upload. It normalizes format AND size. Pre-flight guard: if the compressed blob is still > 20 MB, surface a clear error (extremely unlikely at ≤1600px JPEG).

### Pitfall 4: Orphaned photos
**What goes wrong:** re-uploading after an attach failure creates a duplicate vehicle document that is never linked (silent orphan) — the opposite of D-05.
**How to avoid:** the state machine keeps `documentId` after a successful upload and retries only the attach. (A document that uploads but is never attached before the user leaves is a benign orphan vehicle document — acceptable for v1; note it, don't engineer cleanup.)

### Pitfall 5: The Validate gate (every damage needs a photo)
**What goes wrong:** `POST /inspections/:id/validate` returns `400 "every damage requires at least one photo before closing"` if any damage has zero attached photos — surprising if the UI let the user reach Validate. `[service.go:238-240]`
**How to avoid:** compute per-damage "has ≥1 `attached` photo" client-side; disable Validate (with an explanation) until every damage qualifies; still handle the 400 defensively (a photo could be `uploaded` but not yet `attached`).

### Pitfall 6: Return without a validated departure
**What goes wrong:** creating a `return` inspection → `409` if no validated `departure` exists.
**How to avoid:** only offer "return" once a validated departure inspection exists for the contract; surface the 409 message otherwise.

### Pitfall 7: EXIF/GPS lost on canvas re-encode
**What goes wrong:** canvas `toBlob` strips EXIF, so the backend's best-effort `taken_at`/GPS extraction gets nothing.
**Assessment:** EXIF GPS is best-effort and non-essential for v1 inspection integrity (the damage record + photo bytes are what matter). Recommend **compress for reliability** and accept EXIF loss. If GPS ever becomes required, that's a deliberate tradeoff to revisit (send the original JPEG for GPS at the cost of larger uploads). Flag as an `[ASSUMED]` non-requirement — confirm with the user if inspection GPS provenance matters.

### Pitfall 8: The last-placeholder E2E / route-test migration (MUST DO)
**What goes wrong:** `/etats-des-lieux` is the **last base-nav placeholder**. Two tests hard-depend on it still being a placeholder:
- `src/routes/_authenticated/placeholders.test.tsx` includes `/etats-des-lieux` in `allPlaceholderRoutes` and asserts the shared EmptyState. `[VERIFIED: placeholders.test.tsx:17,36]`
- `e2e/auth.spec.ts` clicks **"États des lieux"** and asserts "Bientôt disponible" / "Coming soon" in **three** tests (owner, agent, language switch). `[VERIFIED: auth.spec.ts:164-169, 195-197, 232-244]`

Once `/etats-des-lieux` becomes real, both break.
**How to avoid — the planner MUST include tasks to:**
1. Remove `/etats-des-lieux` from `allPlaceholderRoutes` in `placeholders.test.tsx` (leaving the three `admin/*` routes, which remain placeholders) and add a NOTE comment like the existing `/vehicules`,`/clients`,`/contrats` notes.
2. In `e2e/auth.spec.ts`, repoint the placeholder-click assertions from **"États des lieux"** to a still-placeholder admin destination (e.g. **"Gestion agences"** / `/admin/agences`), which the owner test already navigates to. For the **agent** test (agents can't see admin nav) and the **language-switch** test, either assert the new real inspection screen's heading, or use another agent-visible target. Simplest: assert the real `/etats-des-lieux` screen's heading (add `inspections.*` headings to fixtures/i18n) instead of the placeholder copy.
3. Ensure the e2e `mockApi` serves the inspection/vehicle/document endpoints the new screen calls (else it 404s into the error banner).

### Pitfall 9: No org-wide contract list for an entry index
**What goes wrong:** there is no "list all contracts" endpoint — only per-vehicle `listContractsByVehicle` `[VERIFIED: contracts/api.ts:98]`. A naive `/etats-des-lieux` "all inspectable contracts" list can't be one call.
**How to avoid:** either make the **contract detail** the primary entry (add an "État des lieux" action there, gated by `canOperate` + status), or reuse the existing client-side per-vehicle fan-out (as `ContractList`/OPS-01 already do). See Entry Topology.

## Entry Topology (Claude's discretion — recommendation)

**Recommended:** primary entry is the **Contract Detail** screen (`contrats/$contractId.tsx` → `ContractDetail.tsx`). Add an "État des lieux" action alongside the existing activate/close/cancel/deposit actions, gated by `mayOperate` and contract status:
- Offer **departure** when the contract is `reserved`/`active` and no validated departure exists.
- Offer **return** when a validated departure exists (and the contract is `active`).

Replace the `/etats-des-lieux` placeholder route with a lightweight **index** that reuses the existing per-vehicle contract fan-out to list contracts needing an inspection (so the nav link is not a dead end), each row linking into the contract-scoped capture screen. Keep the actual capture UI in one shared `InspectionScreen` reached with `{ contractId, kind }`, satisfying D-07. This mirrors how `ContractList`/OPS-01 compose client-side and keeps the backend calls minimal.

## Code Examples

### Create inspection then record a damage (mutations)
```typescript
// api.ts
export const createInspection = (contractId: string, body: CreateInspectionBody) =>
  api.post(`rental-contracts/${encodeURIComponent(contractId)}/inspections`, { json: body })
     .json<InspectionResponse>();

export const recordDamage = (inspectionId: string, body: RecordDamageBody) =>
  api.post(`inspections/${encodeURIComponent(inspectionId)}/damages`, { json: body })
     .json<DamageResponse>();

export const validateInspection = (inspectionId: string) =>
  api.post(`inspections/${encodeURIComponent(inspectionId)}/validate`)
     .json<InspectionResponse>();
```

### Enums as the single source (types)
```typescript
// src/types/inspection.ts
export const ZONES = ["front_bumper","rear_bumper","door_fl","door_fr","door_rl","door_rr","hood","roof","windshield","wheels"] as const;
export const DAMAGE_TYPES = ["scratch","dent","crack","broken"] as const;
export const SEVERITIES = ["minor","moderate","severe"] as const;
export const INSPECTION_KINDS = ["departure","return"] as const;
export type Zone = (typeof ZONES)[number];
// zod: z.enum(ZONES) — drives both validation and the option lists
```

## State of the Art

| Old Approach | Current Approach | Why |
|--------------|------------------|-----|
| `<input type="file">` + manual `FileReader` resize | `createImageBitmap` + canvas `toBlob` | Faster decode, off-main-thread-ish, simpler; universally supported in target mobile browsers (2026) |
| tus/chunked resumable upload | Whole-file + aggressive client compression | Only viable option — backend is whole-file; compression makes whole-file reliable |
| Blanket HTTP retry lib | Per-item visible state machine | "No silent loss" requires per-photo visibility, not an opaque wrapper |

**Deprecated/outdated:** none relevant.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | EXIF/GPS provenance on inspection photos is NOT a v1 requirement (so canvas compression stripping it is acceptable) | Pitfall 7 | If GPS provenance is legally needed, must send original JPEGs (larger, less reliable) — revisit compression |
| A2 | Contract Detail as primary entry + a fan-out index at `/etats-des-lieux` is the desired topology | Entry Topology | User may want a different entry; low cost to change (discretion item) |
| A3 | `type="other"` is the right document type bucket for inspection photos | Photo sequence | Backend accepts it (valid enum); if a dedicated "inspection_photo" type is later added, switch the constant |
| A4 | 3 auto-retries + exponential backoff (1s/2s/4s +jitter) is a reasonable default bound | Pattern 1 | Tunable; no correctness impact — a `failed` photo is always manually retryable |

## Open Questions

1. **Should the departure inspection be launchable directly from the wizard seam, or only from contract detail?**
   - Known: the seam card exists and posts nothing; inspection is decoupled from activate.
   - Unclear: whether the product wants a "continue to inspection" jump right after activation.
   - Recommendation: ship contract-detail entry first; optionally wire the seam card to deep-link into the same screen (cheap follow-up).

2. **Do we surface uploaded-but-unattached orphan documents anywhere?**
   - Recommendation: no cleanup UI in v1; a benign orphan vehicle document is acceptable. Note for a future documents-management phase.

## Environment Availability

Not applicable — this phase is pure frontend (browser web-platform APIs + already-installed npm deps). No new external tools, services, or runtimes. `createImageBitmap`, canvas `toBlob`, `FormData`, `<input capture>`, and `crypto.randomUUID()` are all available in the target evergreen mobile/desktop browsers (2026) and in the vitest jsdom/happy-dom test env (canvas may need a stub in tests — see Validation).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.10 + @testing-library/react + MSW 2.15.0 (unit/integration); Playwright 1.61.1 (e2e) |
| Config file | `vite.config.ts` (test block); `src/test/setup.ts`; `playwright.config.ts` |
| Quick run command | `npx vitest run src/features/inspections` |
| Full suite command | `npm test` (runs `vitest run`, after `generate-routes`) |
| E2E command | `npm run test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INSP-01 | Create departure inspection (mileage+fuel), record damage per zone; enum options match backend set | unit+integration | `npx vitest run src/features/inspections/InspectionScreen.test.tsx` | ❌ Wave 0 |
| INSP-01 | Zone/type/severity zod schema rejects out-of-set values (mirrors backend oneof) | unit | `npx vitest run src/features/inspections/schema.test.ts` | ❌ Wave 0 |
| INSP-02 | **Dropped upload auto-retries and eventually succeeds** (fail-then-succeed MSW handler) | integration | `npx vitest run src/features/inspections/upload/useDamagePhotos.test.tsx` | ❌ Wave 0 |
| INSP-02 | **Permanently failing upload surfaces as `failed` + manual retry, NEVER silently dropped** | integration | same file | ❌ Wave 0 |
| INSP-02 | **Multiple photos upload independently** (one fails, others still reach `attached`) | integration | same file | ❌ Wave 0 |
| INSP-02 | Upload succeeds but attach fails → keeps `document_id`, retry re-attaches only (no re-upload / no orphan) | integration | same file | ❌ Wave 0 |
| INSP-02 | `compressImage` downscales a large image below the size cap and outputs JPEG | unit | `npx vitest run src/features/inspections/upload/compressImage.test.ts` | ❌ Wave 0 |
| INSP-02 | Validate blocked (client) + backend 400 handled when a damage has no attached photo | integration | `InspectionScreen.test.tsx` | ❌ Wave 0 |
| INSP-03 | Return inspection reuses the same components; 409 surfaced when no validated departure | integration | `InspectionScreen.test.tsx` | ❌ Wave 0 |
| INSP-01/03 | canOperate gate hides write actions for read-only scope on the vehicle's agency | unit | `InspectionScreen.test.tsx` | ❌ Wave 0 |
| cross | Last-placeholder migration: placeholders.test.tsx no longer references `/etats-des-lieux`; e2e repointed | unit+e2e | `npx vitest run src/routes/_authenticated/placeholders.test.tsx` / `npm run test:e2e` | ⚠️ update existing |

### The critical resilience tests (MSW design)
Add inspection + document handlers to `src/test/mocks/handlers.ts` and a fixtures file `src/test/fixtures/inspections.ts`:
- `POST /vehicles/:vehicleId/documents` — a **programmable** handler that fails N times then succeeds (e.g. a per-test counter or a `?failtimes` convention) so the auto-retry test can assert eventual `attached`, and a "always 503" variant for the permanent-failure test.
- `POST /inspection-damages/:damageId/photos` — returns `204`; a variant returning `500` to test the attach-only retry (assert the upload handler is NOT hit a second time → no orphan).
- `POST /inspections/:id/validate` — returns `400 { message: "every damage requires at least one photo before closing" }` when a test simulates a photoless damage.
- `POST /rental-contracts/:id/inspections` — `409` variant for the return-without-departure test.

Note: jsdom/happy-dom lacks a real canvas — stub `HTMLCanvasElement.prototype.toBlob` and `createImageBitmap` in the test setup (or mock `compressImage`) so the state-machine tests focus on the retry/attach logic, not pixel encoding. Keep one dedicated `compressImage.test.ts` that mocks canvas minimally.

### Sampling Rate
- **Per task commit:** `npx vitest run src/features/inspections`
- **Per wave merge:** `npm test` (full vitest) + `npx tsc -b`
- **Phase gate:** full vitest green + `npm run test:e2e` green (with the placeholder migration applied) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/features/inspections/upload/useDamagePhotos.test.tsx` — the three critical resilience tests + attach-only-retry
- [ ] `src/features/inspections/upload/compressImage.test.ts` — canvas stub + downscale assertion
- [ ] `src/features/inspections/InspectionScreen.test.tsx` — create/record/validate flows, canOperate gate, return-without-departure 409
- [ ] `src/features/inspections/schema.test.ts` — enum oneof parity with backend
- [ ] `src/test/mocks/handlers.ts` — add programmable document-upload + attach + validate + inspection handlers
- [ ] `src/test/fixtures/inspections.ts` — inspection/damage/document fixtures
- [ ] Update `src/routes/_authenticated/placeholders.test.tsx` (remove `/etats-des-lieux`) and `e2e/auth.spec.ts` (repoint placeholder assertions)
- [ ] Test-setup stubs for `createImageBitmap` / `canvas.toBlob`

## Security Domain

`security_enforcement: true`, ASVS level 1, block on high. `[VERIFIED: .planning/config.json]`

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Inherited — the shared `api` client's Bearer + single-flight refresh; no new auth surface |
| V4 Access Control | yes | Client hides write actions via `canOperate(vehicle.agency_id)`; **backend re-enforces** (403/404) — never trust the client gate |
| V5 Input Validation | yes | zod schema from the exact enums; `encodeURIComponent` on every path id; backend re-validates oneof + sniffs real file bytes |
| V6 Cryptography | no | No crypto handled client-side |
| V12 File Upload | yes | Size cap (≤20 MB) enforced server-side (client pre-checks for UX only); content-type **sniffed from bytes** server-side (declared type ignored); type restricted to jpeg/png/webp/pdf |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via crafted contract/damage/vehicle id in URL | Tampering | `encodeURIComponent` each id segment (mirrors contracts/api.ts); backend RLS as backstop |
| Cross-agency access by guessing ids | Elevation of Privilege | Backend `CanRead`/`CanOperate` + RLS → 404/403; client gate is UX-only |
| Malicious file disguised as image | Tampering | Server sniffs real bytes; only jpeg/png/webp accepted; canvas re-encode further normalizes |
| Oversized upload (DoS) | DoS | Server `LimitReader` at 20 MB; client compresses + pre-checks |
| Token leak in logs during upload | Info Disclosure | Never log the FormData/headers; reuse the existing no-secret-logging discipline |

## Sources

### Primary (HIGH confidence — read verbatim from source)
- `wheelio-api/internal/adapter/httpapi/inspection_handler.go` — every endpoint, method, params, status codes
- `wheelio-api/internal/adapter/httpapi/inspection_dto.go` — exact request/response JSON fields
- `wheelio-api/internal/domain/inspection/{inspection.go,damage.go}` — all enums (zone/type/severity/kind/status), decoupling comment
- `wheelio-api/internal/usecase/inspection/service.go` — authz (CanOperate), draft gate, photo-required-on-validate gate, return side-effects, attach-is-pure-link
- `wheelio-api/internal/adapter/httpapi/document_handler.go` + `internal/usecase/document/service.go` — the photo upload path, multipart fields, size/content-type limits, whole-file
- `wheelio-api/internal/adapter/httpapi/server.go` — route registration + `/v1` prefix
- `wheelio-api/internal/platform/config/config.go` + `cmd/api/main.go` — 20 MB upload cap
- `wheelio-front/src/shared/api/client.ts`, `features/{contracts,customers}/*` — ky/refresh, create-then-attach, encodeIdSegment, canOperate gate
- `wheelio-front/src/routes/_authenticated/placeholders.test.tsx`, `e2e/auth.spec.ts` — last-placeholder migration facts
- `wheelio-front/src/shared/i18n/index.ts` — single `common` namespace, FR default

### Secondary (MEDIUM confidence)
- Web-platform capability of `createImageBitmap`/canvas `toBlob`/`<input capture>` in 2026 evergreen browsers — training knowledge, standard and stable

### Tertiary (LOW confidence)
- none

## Metadata

**Confidence breakdown:**
- Backend API contract: HIGH — read verbatim from Go source with file:line
- Enums: HIGH — exact values copied from domain source
- Resilient-upload design: HIGH — grounded in the confirmed two-call, whole-file, photo-gated backend reality
- Entry topology: MEDIUM — a discretion call; recommendation is low-risk to change
- EXIF-non-requirement (A1): LOW — assumption, flagged for user confirmation

**Research date:** 2026-07-29
**Valid until:** 2026-08-28 (stable — the backend module is shipped and unlikely to change; re-verify only if the inspection/document Go source changes)
