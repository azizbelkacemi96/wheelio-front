/**
 * Inspection + damage + photo HTTP calls — thin functions over the shared
 * `api` ky client. No second HTTP client is ever created (05-RESEARCH.md
 * anti-pattern); every request inherits the /v1 prefix + single-flight
 * refresh interceptor from src/shared/api/client.
 *
 * The photo pipeline is deliberately TWO calls (05-RESEARCH.md "The EXACT
 * photo capture → upload → attach call sequence"):
 *   1. uploadPhotoDocument → POST /vehicles/:id/documents (multipart) → 201
 *      documentResponse { id }
 *   2. attachPhoto → POST /inspection-damages/:id/photos { document_id } → 204
 * They are independent; the only coupling is client-side (never attach a
 * document_id you did not just receive). The resilient per-photo state machine
 * in upload/useDamagePhotos.ts orchestrates retries around these.
 */
import { api } from "@/shared/api/client";
import type {
  CreateInspectionBody,
  DamageResponse,
  DocumentResponse,
  InspectionResponse,
  RecordDamageBody,
} from "@/types/inspection";

/** encodeURIComponent every id interpolated into a request path (defense in
 * depth against a crafted path param; mirrors contracts/api.ts). Real UUIDs
 * round-trip unchanged. */
function encodeIdSegment(id: string): string {
  return encodeURIComponent(id);
}

export function createInspection(
  contractId: string,
  body: CreateInspectionBody,
): Promise<InspectionResponse> {
  return api
    .post(`rental-contracts/${encodeIdSegment(contractId)}/inspections`, {
      json: body,
    })
    .json<InspectionResponse>();
}

export function getInspection(inspectionId: string): Promise<InspectionResponse> {
  return api
    .get(`inspections/${encodeIdSegment(inspectionId)}`)
    .json<InspectionResponse>();
}

export function recordDamage(
  inspectionId: string,
  body: RecordDamageBody,
): Promise<DamageResponse> {
  return api
    .post(`inspections/${encodeIdSegment(inspectionId)}/damages`, { json: body })
    .json<DamageResponse>();
}

export function listDamages(inspectionId: string): Promise<DamageResponse[]> {
  return api
    .get(`inspections/${encodeIdSegment(inspectionId)}/damages`)
    .json<DamageResponse[]>();
}

export function validateInspection(
  inspectionId: string,
): Promise<InspectionResponse> {
  return api
    .post(`inspections/${encodeIdSegment(inspectionId)}/validate`)
    .json<InspectionResponse>();
}

/**
 * Step 1 of the photo pipeline: upload the (already client-compressed) image
 * bytes to the vehicle's documents. A FRESH FormData is built on every call —
 * a consumed multipart body must never be replayed (05-RESEARCH.md Pitfall 1),
 * so the app-layer retry re-invokes this rather than reusing ky's internal
 * retry. `timeout: 60_000` overrides ky's 10s default so a photo on a flaky
 * 3G link has headroom. NEVER set Content-Type manually — the browser adds the
 * multipart boundary (Pitfall 2).
 */
export function uploadPhotoDocument(
  vehicleId: string,
  blob: Blob,
  filename: string,
): Promise<DocumentResponse> {
  const form = new FormData();
  form.append("file", blob, filename);
  form.append("type", "other"); // required valid document type (D-A3)
  form.append("title", `inspection-${filename}`);
  return api
    .post(`vehicles/${encodeIdSegment(vehicleId)}/documents`, {
      body: form,
      timeout: 60_000,
    })
    .json<DocumentResponse>();
}

/** Step 2 of the photo pipeline: attach an uploaded document to a damage.
 * Returns 204 No Content — do NOT call `.json()`. */
export async function attachPhoto(
  damageId: string,
  documentId: string,
): Promise<void> {
  await api.post(`inspection-damages/${encodeIdSegment(damageId)}/photos`, {
    json: { document_id: documentId },
  });
}
