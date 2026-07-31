/**
 * Inspection fixtures typed against the DTO mirrors (types/inspection.ts) so
 * any backend-contract drift fails compilation. Used by the MSW handlers and
 * the inspection hook/screen tests.
 */
import type {
  DamageResponse,
  DocumentResponse,
  InspectionResponse,
} from "@/types/inspection";
import { activeContractFixture, vehicleRented } from "./fleet";

const now = "2026-07-30T09:00:00.000Z";

export const inspectionDraftFixture: InspectionResponse = {
  id: "10101010-1010-4101-8101-101010101010",
  contract_id: activeContractFixture.id,
  agency_id: vehicleRented.agency_id,
  kind: "departure",
  status: "draft",
  mileage: 18650,
  fuel_level: "three_quarters",
  created_at: now,
  updated_at: now,
};

export const inspectionValidatedFixture: InspectionResponse = {
  ...inspectionDraftFixture,
  status: "validated",
  validated_at: now,
};

export const damageFixture: DamageResponse = {
  id: "20202020-2020-4202-8202-202020202020",
  inspection_id: inspectionDraftFixture.id,
  zone: "door_fl",
  damage_type: "scratch",
  severity: "minor",
  position: "bas de porte",
  description: "Rayure superficielle",
  created_at: now,
};

export const uploadedDocumentFixture: DocumentResponse = {
  id: "30303030-3030-4303-8303-303030303030",
  vehicle_id: vehicleRented.id,
  type: "other",
  title: "inspection-photo.jpg",
  content_type: "image/jpeg",
  size_bytes: 512000,
  sha256: "0".repeat(64),
  created_at: now,
};
