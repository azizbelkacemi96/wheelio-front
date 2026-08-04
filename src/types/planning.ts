/**
 * DTOs mirroring wheelio-api's GET /planning — the fleet calendar for a date
 * window (vehicles + overlapping bookings + unavailability), computed in a few
 * org-scoped SQL queries.
 */

export interface PlanningVehicle {
  id: string;
  agency_id: string;
  registration_plate: string;
  brand: string;
  model: string;
  class_id?: string;
  status: string;
}

export interface PlanningBooking {
  id: string;
  vehicle_id: string;
  customer_id: string;
  status: "reserved" | "active" | "closed";
  starts_at: string; // RFC3339
  ends_at: string;
}

export interface PlanningUnavailability {
  id: string;
  vehicle_id: string;
  reason: string;
  description?: string;
  starts_at: string;
  ends_at: string;
}

export interface PlanningResponse {
  vehicles: PlanningVehicle[];
  bookings: PlanningBooking[];
  unavailability: PlanningUnavailability[];
}
