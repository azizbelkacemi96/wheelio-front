/**
 * DTOs mirroring wheelio-api's document HTTP contract 1:1.
 *
 * Source: `internal/adapter/httpapi/document_handler.go` (documentResponse,
 * expiringDocumentResponse, signedURLResponse) + the valid document-type set.
 * Documents are VEHICLE-scoped (upload at POST /vehicles/:id/documents).
 */

export const DOCUMENT_TYPES = [
  "registration_card",
  "insurance",
  "technical_inspection",
  "rental_contract",
  "invoice",
  "other",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export interface DocumentResponse {
  id: string;
  vehicle_id: string;
  type: DocumentType;
  title: string;
  content_type: string;
  size_bytes: number;
  sha256: string;
  issued_at?: string; // YYYY-MM-DD
  expires_at?: string; // YYYY-MM-DD
  uploaded_by?: string;
  created_at: string; // RFC3339
  taken_at?: string;
  gps_latitude?: number | null;
  gps_longitude?: number | null;
}

/** GET /documents/expiring element — the doc plus its vehicle's plate/agency. */
export interface ExpiringDocumentResponse {
  document: DocumentResponse;
  agency_id: string;
  registration_plate: string;
}

/** GET /documents/:id/download-url — a short-lived signed URL usable directly
 * as an <img src> or download href (no Authorization header needed). */
export interface SignedURLResponse {
  url: string;
  expires_at: string;
}
