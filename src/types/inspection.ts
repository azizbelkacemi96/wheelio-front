/**
 * DTOs + enums mirroring wheelio-api's inspection HTTP contract 1:1.
 *
 * Source of truth (read verbatim, 05-RESEARCH.md):
 * - `internal/domain/inspection/{inspection.go,damage.go}` — zone / damage_type
 *   / severity / kind / status enums
 * - `internal/adapter/httpapi/inspection_dto.go` — request/response JSON fields
 * - `internal/adapter/httpapi/document_handler.go` — the photo `documentResponse`
 *
 * These `as const` arrays are the SINGLE source for both the zod `oneof`
 * schemas AND the UI option lists — never duplicate the value lists. i18n
 * label keys: `inspections.zone.<v>`, `inspections.damageType.<v>`,
 * `inspections.severity.<v>` (fuel labels reuse `vehicles.fuelLevel.<v>`).
 *
 * omitempty rule (same as rental.ts): every Go `omitempty` field is optional
 * here — the key is ABSENT from the JSON when unset, never `null`/`""`.
 */

import type { FuelLevel } from "./rental";

export const ZONES = [
  "front_bumper",
  "rear_bumper",
  "door_fl",
  "door_fr",
  "door_rl",
  "door_rr",
  "hood",
  "roof",
  "windshield",
  "wheels",
] as const;
export type Zone = (typeof ZONES)[number];

export const DAMAGE_TYPES = ["scratch", "dent", "crack", "broken"] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

export const SEVERITIES = ["minor", "moderate", "severe"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const INSPECTION_KINDS = ["departure", "return"] as const;
export type InspectionKind = (typeof INSPECTION_KINDS)[number];

export type InspectionStatus = "draft" | "validated";

// ---- Responses ----

export interface InspectionResponse {
  id: string;
  contract_id: string;
  agency_id: string;
  kind: InspectionKind;
  status: InspectionStatus;
  mileage: number;
  fuel_level: FuelLevel;
  validated_at?: string; // RFC3339, omitempty
  created_at: string;
  updated_at: string;
}

/** NOTE: no `photos` field — there is no way to read a damage's photos back
 * (05-RESEARCH.md). During capture the client is the only place that knows a
 * damage's photos; previews come from `URL.createObjectURL(file)`. */
export interface DamageResponse {
  id: string;
  inspection_id: string;
  zone: Zone;
  damage_type: DamageType;
  severity: Severity;
  position?: string; // omitempty
  description?: string; // omitempty
  created_at: string;
}

/** The vehicle-document created by the photo upload — only `id` (the
 * document_id to attach) is used downstream, the rest mirrors the backend. */
export interface DocumentResponse {
  id: string;
  vehicle_id: string;
  type: string;
  title: string;
  content_type: string;
  size_bytes: number;
  sha256: string;
  created_at: string;
  taken_at?: string;
  gps_latitude?: number | null;
  gps_longitude?: number | null;
}

// ---- Request bodies ----

/** POST /rental-contracts/:contractID/inspections (inspection_dto.go:16-20). */
export interface CreateInspectionBody {
  kind: InspectionKind;
  mileage: number; // gte=0
  fuel: FuelLevel; // required oneof
}

/** POST /inspections/:inspectionID/damages (inspection_dto.go:25-31). */
export interface RecordDamageBody {
  zone: Zone;
  damage_type: DamageType;
  severity: Severity;
  position?: string; // optional free string
  description?: string; // optional free string
}

/** POST /inspection-damages/:damageID/photos (inspection_dto.go:35-37). */
export interface AttachPhotoBody {
  document_id: string;
}
