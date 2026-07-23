/**
 * DTOs mirroring wheelio-api's fleet HTTP contract 1:1.
 *
 * Source of truth: wheelio-api `internal/adapter/httpapi/fleet_dto.go`
 * (`vehicleResponse`, json tags) and `internal/domain/fleet/vehicle.go`
 * (status / fuel type / transmission enum values). Any change to those Go
 * types must be mirrored here — this file is a read-only reflection of the
 * backend contract, never an independent source of truth.
 *
 * omitempty rule: every Go `omitempty` field is optional (`?:`) here — the
 * key is ABSENT from the JSON when unset, never `null` or `""`.
 */

export type VehicleStatus = "available" | "rented" | "maintenance" | "retired";

export type FuelType = "petrol" | "diesel" | "hybrid" | "electric" | "lpg";

export type Transmission = "manual" | "automatic";

export interface VehicleResponse {
  id: string;
  agency_id: string;
  vin: string;
  registration_plate: string;
  brand: string;
  model: string;
  model_year?: number;
  color?: string;
  fuel_type: FuelType;
  transmission: Transmission;
  seats?: number;
  current_mileage: number; // km
  status: VehicleStatus;
  purchase_date?: string; // YYYY-MM-DD
  purchase_price_cents?: number;
  notes?: string;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}
