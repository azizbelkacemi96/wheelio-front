/**
 * Per-photo upload state machine (INSP-02, the resilience core — pure, no
 * React, fully unit-testable). Each captured photo is one `PhotoItem` with an
 * explicit `status`; the two-call upload→attach sequence drives the
 * transitions, with app-layer bounded backoff retry (05-RESEARCH.md Pattern 1).
 *
 * "No silent loss" is the invariant: a photo is `attached` (done) ONLY after
 * the 204 attach; anything else is a visible non-terminal or `failed` state a
 * user can retry — a dropped request never disappears.
 */

export type PhotoStatus =
  | "queued"
  | "compressing"
  | "uploading"
  | "uploaded"
  | "attaching"
  | "attached"
  | "failed";

export interface PhotoItem {
  /** client-side id (crypto.randomUUID) — stable across retries. */
  id: string;
  file: File;
  /** URL.createObjectURL(file) for local preview — revoked on removal. */
  previewUrl: string;
  status: PhotoStatus;
  /** set after a successful upload; an attach-only retry reuses it so the
   * document is NEVER re-uploaded (no orphan vehicle document). */
  documentId?: string;
  /** number of attempts consumed so far (bounds the auto-retry). */
  attempts: number;
  /** last error message, surfaced in the UI. */
  error?: string;
}

/** Auto-retry ceiling; beyond it a photo lands in `failed` (still manually
 * retryable via the UI). */
export const MAX_AUTO_ATTEMPTS = 3;

/** Bounded exponential backoff with jitter (ms). attempt is 1-based. */
export function backoffMs(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 8000) + Math.random() * 250;
}

/** A photo is "done for the validate gate" only once attached. */
export function isAttached(p: PhotoItem): boolean {
  return p.status === "attached";
}

/** True while a photo is still working toward `attached` (not failed, not
 * done) — used to show in-progress affordances and to know a session is busy. */
export function isInFlight(p: PhotoItem): boolean {
  return p.status !== "attached" && p.status !== "failed";
}

/** The status a photo resets to before a (re)run: skip straight to the attach
 * leg when a document was already uploaded (attach-only retry), otherwise
 * start from the beginning. */
export function resumeStatus(p: PhotoItem): PhotoStatus {
  return p.documentId ? "uploaded" : "queued";
}
