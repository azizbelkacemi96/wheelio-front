/**
 * compressImage downscales past the max edge and outputs JPEG (INSP-02). jsdom
 * has no real canvas, so createImageBitmap + canvas 2d ctx + toBlob are stubbed
 * minimally — the assertion is on the resulting dimensions + type, not pixels.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { compressImage } from "./compressImage";

describe("compressImage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("scales the longest edge down to the cap and re-encodes as JPEG", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 4000, height: 3000, close: vi.fn() })),
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);

    let capturedW = 0;
    let capturedH = 0;
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
      this: HTMLCanvasElement,
      cb: BlobCallback,
      type?: string,
    ) {
      capturedW = this.width;
      capturedH = this.height;
      cb(new Blob(["jpeg-bytes"], { type: type ?? "image/jpeg" }));
    });

    const file = new File(["x"], "huge.jpg", { type: "image/jpeg" });
    const blob = await compressImage(file, 1600, 0.8);

    expect(blob.type).toBe("image/jpeg");
    // 1600/4000 = 0.4 → 4000*0.4=1600, 3000*0.4=1200.
    expect(capturedW).toBe(1600);
    expect(capturedH).toBe(1200);
  });

  it("never upscales a small image", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 800, height: 600, close: vi.fn() })),
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    let capturedW = 0;
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
      this: HTMLCanvasElement,
      cb: BlobCallback,
    ) {
      capturedW = this.width;
      cb(new Blob(["jpeg"], { type: "image/jpeg" }));
    });

    await compressImage(new File(["x"], "small.jpg", { type: "image/jpeg" }), 1600);
    expect(capturedW).toBe(800); // unchanged (scale clamped to 1)
  });
});
