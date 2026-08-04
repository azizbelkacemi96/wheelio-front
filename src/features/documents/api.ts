/**
 * Vehicle-document HTTP calls (Phase 8) — thin functions over the shared `api`
 * ky client. Documents cover both recognition PHOTOS (images) and legal papers
 * (carte grise / assurance / contrôle technique) with optional issue/expiry
 * dates; the backend sniffs real bytes (jpeg/png/webp/pdf, ≤20 MB).
 *
 * Multipart upload builds a fresh FormData per call and NEVER sets Content-Type
 * (the browser adds the boundary). Image previews use the short-lived signed
 * URL from download-url (usable directly as <img src>, no auth header).
 */
import { api } from "@/shared/api/client";
import type {
  DocumentResponse,
  DocumentType,
  ExpiringDocumentResponse,
  SignedURLResponse,
} from "@/types/document";

/**
 * The backend returns the signed download link as a ROOT-RELATIVE path
 * (`/v1/files/...`). Used directly as an <img src>, a relative path resolves
 * against the FRONTEND origin (e.g. :5173 in dev), not the API (:8080) — so the
 * image 404s and shows broken. Resolve it against the API origin so the <img>
 * hits the API host. Absolute URLs (future S3/CDN) pass through unchanged.
 */
const API_ORIGIN = (() => {
  try {
    return new URL(import.meta.env.VITE_API_URL ?? "http://localhost:8080/v1").origin;
  } catch {
    return "";
  }
})();

function toAbsoluteFileURL(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `${API_ORIGIN}${url}`;
}

function encodeIdSegment(id: string): string {
  return encodeURIComponent(id);
}

export interface UploadDocumentInput {
  file: File;
  type: DocumentType;
  title?: string;
  issuedAt?: string; // YYYY-MM-DD
  expiresAt?: string; // YYYY-MM-DD
}

export function uploadDocument(
  vehicleId: string,
  input: UploadDocumentInput,
): Promise<DocumentResponse> {
  const form = new FormData();
  form.append("file", input.file, input.file.name);
  form.append("type", input.type);
  if (input.title) form.append("title", input.title);
  if (input.issuedAt) form.append("issued_at", input.issuedAt);
  if (input.expiresAt) form.append("expires_at", input.expiresAt);
  return api
    .post(`vehicles/${encodeIdSegment(vehicleId)}/documents`, {
      body: form,
      timeout: 60_000,
    })
    .json<DocumentResponse>();
}

export function listVehicleDocuments(
  vehicleId: string,
): Promise<DocumentResponse[]> {
  return api
    .get(`vehicles/${encodeIdSegment(vehicleId)}/documents`)
    .json<DocumentResponse[]>();
}

export async function getDocumentDownloadURL(
  documentId: string,
): Promise<SignedURLResponse> {
  const res = await api
    .get(`documents/${encodeIdSegment(documentId)}/download-url`)
    .json<SignedURLResponse>();
  // Make the signed link absolute against the API origin (see toAbsoluteFileURL).
  return { ...res, url: toAbsoluteFileURL(res.url) };
}

export function deleteDocument(documentId: string): Promise<void> {
  return api
    .delete(`documents/${encodeIdSegment(documentId)}`)
    .then(() => undefined);
}

export function listExpiringDocuments(
  withinDays = 30,
): Promise<ExpiringDocumentResponse[]> {
  return api
    .get("documents/expiring", {
      searchParams: { within: String(withinDays) },
    })
    .json<ExpiringDocumentResponse[]>();
}
