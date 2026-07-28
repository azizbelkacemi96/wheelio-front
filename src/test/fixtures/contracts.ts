import type { ContractResponse } from "@/types/rental";
import {
  activeContractFixture,
  vehicleAvailable,
  vehicleRented,
} from "./fleet";
import { customerCompany, customerIndividualCin } from "./customers";

/**
 * Rental-contract fixtures typed against the DTO mirror (types/rental.ts) so
 * any backend-contract drift fails compilation. Every `vehicle_id` /
 * `customer_id` points at a REAL fleet/customer fixture id so the name/plate/
 * agency joins (features/contracts/resolve.ts) resolve against actual data.
 *
 * Coverage guarantees relied on by the MSW handlers and hook tests:
 * - one contract in EACH status: reserved / active / closed / cancelled
 *   (the `active` one is re-exported from fleet.ts to avoid duplication);
 * - an OVERLAP PAIR — two reserved contracts on the SAME vehicle with
 *   overlapping windows — for the create-409 scenario;
 * - a `reservedTodayContract` (starts_at = today, Africa/Algiers) and an
 *   `activeEndingTodayContract` (ends_at = today) for the OPS-01 overview.
 *
 * `contractResponse` carries ONLY vehicle_id + customer_id UUIDs (no plate,
 * no customer name, no agency_id) — every display join is resolved elsewhere.
 */

const AGENCY_ALGER_VEHICLE_ID = vehicleAvailable.id;

/**
 * "Today" in Africa/Algiers (UTC+1, no DST), computed once at module load so
 * OPS-01 tests can assert pickups/returns due today without pinning a clock.
 * We build a full RFC3339 timestamp at 09:00 Algiers local for the day key
 * that Intl reports for `now` in the Algiers zone.
 */
const algiersDayKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Algiers",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const todayStartAlgiers = `${algiersDayKey}T09:00:00+01:00`;
const todayEndAlgiers = `${algiersDayKey}T18:00:00+01:00`;

export const reservedContract: ContractResponse = {
  id: "10101010-1010-4010-8010-101010101010",
  vehicle_id: vehicleAvailable.id,
  customer_id: customerIndividualCin.id,
  status: "reserved",
  starts_at: "2026-08-10T09:00:00.000Z",
  ends_at: "2026-08-15T09:00:00.000Z",
  created_at: "2026-08-01T10:00:00.000Z",
  updated_at: "2026-08-01T10:00:00.000Z",
};

/** Re-export the shipped active fixture so there is a single source of truth. */
export { activeContractFixture };

export const closedContract: ContractResponse = {
  id: "20202020-2020-4020-8020-202020202020",
  vehicle_id: vehicleRented.id,
  customer_id: customerCompany.id,
  status: "closed",
  starts_at: "2026-05-01T09:00:00.000Z",
  ends_at: "2026-05-08T09:00:00.000Z",
  actual_departure_at: "2026-05-01T09:15:00.000Z",
  departure_mileage: 15200,
  departure_fuel_level: "full",
  actual_return_at: "2026-05-08T17:40:00.000Z",
  return_mileage: 16050,
  return_fuel_level: "half",
  created_at: "2026-04-28T11:00:00.000Z",
  updated_at: "2026-05-08T17:40:00.000Z",
};

export const cancelledContract: ContractResponse = {
  id: "30303030-3030-4030-8030-303030303030",
  vehicle_id: vehicleAvailable.id,
  customer_id: customerCompany.id,
  status: "cancelled",
  starts_at: "2026-09-01T09:00:00.000Z",
  ends_at: "2026-09-05T09:00:00.000Z",
  cancel_reason: "Client a annulé sa demande.",
  cancelled_at: "2026-08-20T08:30:00.000Z",
  created_at: "2026-08-15T09:00:00.000Z",
  updated_at: "2026-08-20T08:30:00.000Z",
};

/**
 * OVERLAP PAIR — two reserved contracts on the SAME vehicle whose windows
 * intersect. Sending a create body matching `overlapReservedB`'s window on
 * `overlapVehicleId` is what the MSW create handler treats as a 409 overlap.
 */
export const overlapVehicleId = AGENCY_ALGER_VEHICLE_ID;

export const overlapReservedA: ContractResponse = {
  id: "40404040-4040-4040-8040-404040404040",
  vehicle_id: overlapVehicleId,
  customer_id: customerIndividualCin.id,
  status: "reserved",
  starts_at: "2026-10-10T09:00:00.000Z",
  ends_at: "2026-10-20T09:00:00.000Z",
  created_at: "2026-09-30T09:00:00.000Z",
  updated_at: "2026-09-30T09:00:00.000Z",
};

export const overlapReservedB: ContractResponse = {
  id: "50505050-5050-4050-8050-505050505050",
  vehicle_id: overlapVehicleId,
  customer_id: customerCompany.id,
  status: "reserved",
  // Overlaps overlapReservedA's [10-10, 10-20] window.
  starts_at: "2026-10-15T09:00:00.000Z",
  ends_at: "2026-10-25T09:00:00.000Z",
  created_at: "2026-09-30T10:00:00.000Z",
  updated_at: "2026-09-30T10:00:00.000Z",
};

/** OPS-01: a reservation whose `starts_at` is today in Africa/Algiers. */
export const reservedTodayContract: ContractResponse = {
  id: "60606060-6060-4060-8060-606060606060",
  vehicle_id: vehicleAvailable.id,
  customer_id: customerIndividualCin.id,
  status: "reserved",
  starts_at: todayStartAlgiers,
  ends_at: "2026-12-31T18:00:00+01:00",
  created_at: "2026-07-01T09:00:00.000Z",
  updated_at: "2026-07-01T09:00:00.000Z",
};

/** OPS-01: an active contract whose `ends_at` is today in Africa/Algiers. */
export const activeEndingTodayContract: ContractResponse = {
  id: "70707070-7070-4070-8070-707070707070",
  vehicle_id: vehicleRented.id,
  customer_id: customerCompany.id,
  status: "active",
  starts_at: "2026-07-01T09:00:00+01:00",
  ends_at: todayEndAlgiers,
  actual_departure_at: "2026-07-01T09:10:00+01:00",
  departure_mileage: 20000,
  departure_fuel_level: "full",
  created_at: "2026-06-30T09:00:00.000Z",
  updated_at: "2026-07-01T09:10:00.000Z",
};

/** Aggregate of every status + the overlap/today cases. */
export const contractFixtures: ContractResponse[] = [
  reservedContract,
  activeContractFixture,
  closedContract,
  cancelledContract,
  overlapReservedA,
  overlapReservedB,
  reservedTodayContract,
  activeEndingTodayContract,
];

/** vehicle_id -> its contracts, for handlers/hooks to fan out over. */
export const contractsByVehicleId: Record<string, ContractResponse[]> =
  contractFixtures.reduce<Record<string, ContractResponse[]>>((acc, c) => {
    (acc[c.vehicle_id] ??= []).push(c);
    return acc;
  }, {});
