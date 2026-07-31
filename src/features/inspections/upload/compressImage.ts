/**
 * Client-side image downscale + re-encode before upload (INSP-02, zero-dep).
 *
 * The single highest-leverage reliability move (05-RESEARCH.md Pattern 3):
 * - normalizes any decodable input (JPEG/PNG/WebP/HEIC-if-OS-supported) to
 *   JPEG — a backend-allowed type (HEIC would otherwise be rejected);
 * - shrinks 3-12 MB phone photos to ~0.3-0.8 MB so a whole-file upload
 *   survives a flaky field link and stays well under the 20 MB server cap.
 *
 * Tradeoff (accepted, D-A1): canvas re-encode strips EXIF/GPS. Inspection
 * integrity rests on the damage record + photo bytes, not on GPS provenance.
 */

/**
 * Downscale `file` so its longest edge is ≤ `maxEdge`, re-encode as JPEG at
 * `quality`, and return the resulting Blob. Never upscales (scale is clamped
 * to ≤ 1). Throws if the browser cannot produce a blob.
 */
export async function compressImage(
  file: File,
  maxEdge = 1600,
  quality = 0.8,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d context unavailable");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("image compression failed"))),
        "image/jpeg",
        quality,
      ),
    );
  } finally {
    bitmap.close();
  }
}
