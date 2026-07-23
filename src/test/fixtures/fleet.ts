import type { VehicleResponse } from "@/types/fleet";
import type { ContractResponse } from "@/types/rental";
import { ownerFixture } from "./scope";

/**
 * Fleet fixtures typed against the DTO mirrors (types/fleet.ts /
 * types/rental.ts) so any backend-contract drift fails compilation.
 *
 * Coverage guarantees relied on by the MSW handlers and hook tests:
 * - all FOUR vehicle statuses appear at least once;
 * - vehicles are spread across BOTH scope.ts agencies (Alger/Oran) so
 *   agency_id filtering and owner-view agency-name resolution are testable;
 * - exactly one vehicle (`vehicleRented`) has a matching `active` contract,
 *   which carries `departure_mileage` + `departure_fuel_level` (always set
 *   on activation per rental_handler.go);
 * - `vehicleBare` has EVERY omitempty field ABSENT (no model_year / color /
 *   seats / purchase_date / purchase_price_cents / notes keys) to keep
 *   optional-field handling honest (02-RESEARCH.md Pitfall 3).
 */

const AGENCY_ALGER_ID = ownerFixture.agencies[0].id;
const AGENCY_ORAN_ID = ownerFixture.agencies[1].id;

const now = "2026-01-01T00:00:00.000Z";

export const vehicleAvailable: VehicleResponse = {
  id: "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1",
  agency_id: AGENCY_ALGER_ID,
  vin: "VF1RFB00066666601",
  registration_plate: "00123-116-16",
  brand: "Renault",
  model: "Clio 5",
  model_year: 2023,
  color: "Blanc",
  fuel_type: "petrol",
  transmission: "manual",
  seats: 5,
  current_mileage: 42350,
  status: "available",
  purchase_date: "2023-03-15",
  purchase_price_cents: 289000000,
  notes: "Révision faite en juin.",
  created_at: now,
  updated_at: now,
};

export const vehicleRented: VehicleResponse = {
  id: "b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2",
  agency_id: AGENCY_ALGER_ID,
  vin: "VF1RFB00066666602",
  registration_plate: "00456-119-16",
  brand: "Dacia",
  model: "Sandero Stepway",
  model_year: 2024,
  color: "Gris",
  fuel_type: "diesel",
  transmission: "manual",
  seats: 5,
  current_mileage: 18900,
  status: "rented",
  created_at: now,
  updated_at: now,
};

export const vehicleMaintenance: VehicleResponse = {
  id: "c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3",
  agency_id: AGENCY_ORAN_ID,
  vin: "VF1RFB00066666603",
  registration_plate: "00789-121-31",
  brand: "Hyundai",
  model: "Tucson",
  model_year: 2022,
  color: "Noir",
  fuel_type: "hybrid",
  transmission: "automatic",
  seats: 5,
  current_mileage: 67200,
  status: "maintenance",
  notes: "Embrayage à contrôler.",
  created_at: now,
  updated_at: now,
};

export const vehicleRetired: VehicleResponse = {
  id: "d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4",
  agency_id: AGENCY_ORAN_ID,
  vin: "VF1RFB00066666604",
  registration_plate: "00321-113-31",
  brand: "Peugeot",
  model: "301",
  model_year: 2016,
  color: "Bleu",
  fuel_type: "lpg",
  transmission: "manual",
  seats: 5,
  current_mileage: 245600,
  status: "retired",
  created_at: now,
  updated_at: now,
};

/** ALL omitempty fields absent — keeps optional-field handling honest. */
export const vehicleBare: VehicleResponse = {
  id: "e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5",
  agency_id: AGENCY_ALGER_ID,
  vin: "VF1RFB00066666605",
  registration_plate: "00654-125-16",
  brand: "Fiat",
  model: "500e",
  fuel_type: "electric",
  transmission: "automatic",
  current_mileage: 3100,
  status: "available",
  created_at: now,
  updated_at: now,
};

export const vehicleFixtures: VehicleResponse[] = [
  vehicleAvailable,
  vehicleRented,
  vehicleMaintenance,
  vehicleRetired,
  vehicleBare,
];

/**
 * The single active contract — belongs to `vehicleRented`.
 * departure_mileage / departure_fuel_level / actual_departure_at are always
 * set on an `active` contract (recorded at activation).
 */
export const activeContractFixture: ContractResponse = {
  id: "f6f6f6f6-f6f6-4f6f-8f6f-f6f6f6f6f6f6",
  vehicle_id: vehicleRented.id,
  customer_id: "77777777-7777-4777-8777-777777777777",
  status: "active",
  starts_at: "2026-06-20T09:00:00.000Z",
  ends_at: "2026-06-27T09:00:00.000Z",
  actual_departure_at: "2026-06-20T09:12:00.000Z",
  departure_mileage: 18650,
  departure_fuel_level: "three_quarters",
  created_at: "2026-06-19T14:00:00.000Z",
  updated_at: "2026-06-20T09:12:00.000Z",
};

export const contractFixtures: ContractResponse[] = [activeContractFixture];
