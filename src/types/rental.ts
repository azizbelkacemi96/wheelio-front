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

/* -------------------------------------------------------------------------
 * Request DTOs — mirror wheelio-api `rental_dto.go` request structs verbatim.
 *
 * Source of truth: wheelio-api `internal/adapter/httpapi/rental_dto.go`
 * (create/activate/close/cancel/deposit request bodies) + validator tags in
 * `internal/domain/rental/contract.go`. Same read-only-mirror discipline as
 * the response DTO above: never an independent source of truth.
 * ---------------------------------------------------------------------- */

/**
 * POST /vehicles/:vehicleID/rental-contracts body (rental_dto.go:22-26).
 * A contract is ALWAYS born `reserved` — there is deliberately NO deposit and
 * NO agency_id here (agency is derived server-side from the vehicle).
 * `ends_at` must be strictly after `starts_at` (else 400).
 */
export interface CreateContractBody {
  customer_id: string; // uuid, required
  starts_at: string; // RFC3339, required
  ends_at: string; // RFC3339, required, strictly after starts_at
}

/**
 * POST /rental-contracts/:contractID/activate body (rental_dto.go:29-33).
 * `mileage` is `gte=0` (0 is valid — always send the key); `fuel` is required.
 * `actual_at` is optional; the server defaults it to now().
 */
export interface ActivateBody {
  actual_at?: string; // RFC3339, optional
  mileage: number; // gte=0
  fuel: FuelLevel; // required, oneof empty|quarter|half|three_quarters|full
}

/**
 * One invoice line in a close body (rental_dto.go:44-51).
 * `unit_price_ht_cents` is HT (hors taxe / pre-VAT) expressed in CENTS.
 * `vat_rate` is an INTEGER percent (e.g. 19 = 19%), never a fraction.
 */
export interface CloseInvoiceLine {
  description: string; // required
  quantity: number; // gt=0
  unit_price_ht_cents: number; // int64, gte=0 — pre-VAT, in cents
  vat_rate: number; // int, gte=0 — integer percent (e.g. 19)
}

/**
 * POST /rental-contracts/:contractID/close body (rental_dto.go:38-51).
 * `invoice_lines` is required with `min=1`; each element is `dive`-validated.
 */
export interface CloseBody {
  actual_at?: string; // RFC3339, optional
  mileage: number; // gte=0
  fuel: FuelLevel; // required, same oneof as activate
  invoice_lines: CloseInvoiceLine[]; // required, min=1
}

/**
 * POST /rental-contracts/:contractID/cancel body (rental_dto.go:55-57).
 * `reason` is required and trimmed non-empty server-side.
 */
export interface CancelBody {
  reason: string; // required, non-empty
}

/**
 * POST /rental-contracts/:contractID/deposit body (rental_dto.go:60-63).
 * `amount_cents` is `gte=0` in cents; `method` is a closed oneof.
 */
export interface DepositBody {
  amount_cents: number; // int64, gte=0 — in cents
  method: "cash" | "card" | "transfer"; // oneof
}
