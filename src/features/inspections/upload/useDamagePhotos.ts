/**
 * Hook driving ONE damage's photos independently (INSP-02). Owns the list of
 * `PhotoItem`s and runs each through the upload→attach sequence with bounded
 * auto-retry (05-RESEARCH.md Pattern 1). Each photo progresses on its own
 * async loop, so one failing photo never blocks the others (a success
 * criterion).
 *
 * Dependencies (compress / upload / attach / backoff) are INJECTABLE with real
 * defaults: production wires the ky-backed api.ts + canvas compressImage;
 * tests inject fast fakes to exercise the retry/attach-only/failed transitions
 * deterministically without a real canvas or network.
 *
 * Partial-failure discipline (D-05): once `uploadPhotoDocument` succeeds the
 * `documentId` is kept, so a subsequent failure retries ONLY the attach —
 * never a second upload (which would create an orphan vehicle document).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { compressImage } from "./compressImage";
import { attachPhoto, uploadPhotoDocument } from "../api";
import {
  MAX_AUTO_ATTEMPTS,
  backoffMs,
  isAttached,
  isInFlight,
  resumeStatus,
  type PhotoItem,
} from "./photoUploadMachine";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** createObjectURL is absent in some test DOMs — degrade to "" rather than
 * throw (previews just don't render there). */
function previewFor(file: File): string {
  return typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
    ? URL.createObjectURL(file)
    : "";
}

function revokePreview(url: string): void {
  if (url && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(url);
  }
}

export interface UseDamagePhotosOptions {
  compress?: (file: File) => Promise<Blob>;
  upload?: (vehicleId: string, blob: Blob, filename: string) => Promise<{ id: string }>;
  attach?: (damageId: string, documentId: string) => Promise<void>;
  /** ms to wait before auto-retry attempt N (1-based). Tests pass () => 0. */
  backoff?: (attempt: number) => number;
}

export interface DamagePhotosApi {
  photos: PhotoItem[];
  /** Queue File(s) from the capture input and start uploading each. */
  addFiles: (files: FileList | File[]) => void;
  /** Manually retry a `failed` photo (resets the attempt budget). */
  retry: (id: string) => void;
  /** Remove a photo (revokes its preview URL). */
  remove: (id: string) => void;
  /** ≥1 photo attached — the per-damage Validate-gate predicate. */
  hasAttached: boolean;
  /** any photo still working toward attached. */
  isBusy: boolean;
}

export function useDamagePhotos(
  damageId: string,
  vehicleId: string,
  options: UseDamagePhotosOptions = {},
): DamagePhotosApi {
  const compress = options.compress ?? compressImage;
  const upload = options.upload ?? uploadPhotoDocument;
  const attach = options.attach ?? attachPhoto;
  const backoff = options.backoff ?? backoffMs;

  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const photosRef = useRef<PhotoItem[]>([]);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Revoke any object URLs created during this session.
      for (const p of photosRef.current) revokePreview(p.previewUrl);
    };
  }, []);

  // photosRef is the synchronous source of truth (async run loops read it
  // between awaits); setPhotos only mirrors it into render. Never mutate the
  // ref inside a setState updater — React may invoke updaters eagerly and/or
  // twice, which would corrupt the ref. commit() updates both explicitly.
  const commit = useCallback((next: PhotoItem[]) => {
    photosRef.current = next;
    if (mounted.current) setPhotos(next);
  }, []);

  const patch = useCallback(
    (id: string, partial: Partial<PhotoItem>) => {
      commit(photosRef.current.map((p) => (p.id === id ? { ...p, ...partial } : p)));
    },
    [commit],
  );

  const run = useCallback(
    async (id: string) => {
      // Loop until attached, exhausted, or the item is gone (removed).
      for (;;) {
        const item = photosRef.current.find((p) => p.id === id);
        if (!item) return;
        try {
          let documentId = item.documentId;
          if (!documentId) {
            patch(id, { status: "compressing", error: undefined });
            const blob = await compress(item.file);
            patch(id, { status: "uploading" });
            const doc = await upload(vehicleId, blob, item.file.name);
            documentId = doc.id;
            patch(id, { status: "uploaded", documentId });
          }
          patch(id, { status: "attaching", error: undefined });
          await attach(damageId, documentId);
          patch(id, { status: "attached" });
          return;
        } catch (err) {
          const current = photosRef.current.find((p) => p.id === id);
          if (!current) return;
          const attempts = current.attempts + 1;
          const message = errorMessage(err);
          if (attempts < MAX_AUTO_ATTEMPTS) {
            patch(id, { status: resumeStatus(current), attempts, error: message });
            await sleep(backoff(attempts));
            continue;
          }
          patch(id, { status: "failed", attempts, error: message });
          return;
        }
      }
    },
    [attach, backoff, compress, damageId, patch, upload, vehicleId],
  );

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;
      const items: PhotoItem[] = list.map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: previewFor(file),
        status: "queued",
        attempts: 0,
      }));
      commit([...photosRef.current, ...items]);
      for (const item of items) void run(item.id);
    },
    [commit, run],
  );

  const retry = useCallback(
    (id: string) => {
      const item = photosRef.current.find((p) => p.id === id);
      if (!item) return;
      patch(id, { attempts: 0, error: undefined, status: resumeStatus(item) });
      void run(id);
    },
    [patch, run],
  );

  const remove = useCallback(
    (id: string) => {
      const target = photosRef.current.find((p) => p.id === id);
      if (target) revokePreview(target.previewUrl);
      commit(photosRef.current.filter((p) => p.id !== id));
    },
    [commit],
  );

  return {
    photos,
    addFiles,
    retry,
    remove,
    hasAttached: photos.some(isAttached),
    isBusy: photos.some(isInFlight),
  };
}
