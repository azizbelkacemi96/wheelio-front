/**
 * DTOs mirroring wheelio-api's rental HTTP contract 1:1.
 *
 * Source of truth: wheelio-api `internal/adapter/httpapi/rental_dto.go`
 * (`contractResponse`, json tags) and `internal/domain/rental/contract.go`
 * (contract status / fuel level enum values). Any change to those Go types
 * must be mirrored here — this file is a read-only reflection of the backend
 * contract, never an independent source of truth. Phase 4 will extend it.
 *
 * omitempty rule: every Go `omitempty` field is optional (`?:`) here — the
 * key is ABSENT from the JSON when unset, never `null` or `""`.
 */

export type ContractStatus = "reserved" | "active" | "closed" | "cancelled";

export type FuelLevel =
  | "empty"
  | "quarter"
  | "half"
  | "three_quarters"
  | "full";

export interface ContractResponse {
  id: string;
  vehicle_id: string;
  customer_id: string; // UUID only — no customer name in this response
  status: ContractStatus;
  starts_at: string; // RFC3339
  ends_at: string; // RFC3339
  actual_departure_at?: string;
  departure_mileage?: number;
  departure_fuel_level?: FuelLevel;
  actual_return_at?: string;
  return_mileage?: number;
  return_fuel_level?: FuelLevel;
  cancel_reason?: string;
  cancelled_at?: string;
  deposit_amount_cents?: number;
  deposit_method?: string;
  deposit_returned_amount_cents?: number;
  deposit_returned_at?: string;
  deposit_note?: string;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}
