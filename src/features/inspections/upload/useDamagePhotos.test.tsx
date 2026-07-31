/**
 * The critical INSP-02 resilience tests. Deps (compress/upload/attach/backoff)
 * are INJECTED as fast fakes so the retry/attach-only/failed transitions are
 * exercised deterministically — no real canvas, no network, no wall-clock
 * backoff. This is where "resilient to flaky connectivity, no silent loss" is
 * proven.
 */
import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useDamagePhotos, type UseDamagePhotosOptions } from "./useDamagePhotos";

const jpeg = (name: string) => new File(["x"], name, { type: "image/jpeg" });
const compress = async () => new Blob(["compressed"], { type: "image/jpeg" });
const base = (over: Partial<UseDamagePhotosOptions>): UseDamagePhotosOptions => ({
  compress,
  backoff: () => 0, // instant retries
  ...over,
});

describe("useDamagePhotos — resilience", () => {
  it("auto-retries a dropped upload and eventually reaches attached", async () => {
    let uploadCalls = 0;
    const upload = vi.fn(async () => {
      uploadCalls += 1;
      if (uploadCalls < 2) throw new Error("network dropped");
      return { id: "doc-1" };
    });
    const attach = vi.fn(async () => {});

    const { result } = renderHook(() =>
      useDamagePhotos("d1", "v1", base({ upload, attach })),
    );

    act(() => result.current.addFiles([jpeg("a.jpg")]));

    await waitFor(() => expect(result.current.photos[0]?.status).toBe("attached"));
    expect(uploadCalls).toBe(2); // failed once, retried once
    expect(attach).toHaveBeenCalledTimes(1);
    expect(result.current.hasAttached).toBe(true);
  });

  it("surfaces a permanently failing upload as `failed` (never dropped), and a manual retry can recover it", async () => {
    let mode: "fail" | "ok" = "fail";
    let uploadCalls = 0;
    const upload = vi.fn(async () => {
      uploadCalls += 1;
      if (mode === "fail") throw new Error("still offline");
      return { id: "doc-9" };
    });
    const attach = vi.fn(async () => {});

    const { result } = renderHook(() =>
      useDamagePhotos("d1", "v1", base({ upload, attach })),
    );

    act(() => result.current.addFiles([jpeg("a.jpg")]));

    // Exhausts the auto-retry budget → visible failed state, NOT removed.
    await waitFor(() => expect(result.current.photos[0]?.status).toBe("failed"));
    expect(result.current.photos).toHaveLength(1);
    expect(result.current.hasAttached).toBe(false);

    // Connectivity restored + manual retry → recovers to attached.
    mode = "ok";
    act(() => result.current.retry(result.current.photos[0].id));
    await waitFor(() => expect(result.current.photos[0]?.status).toBe("attached"));
    expect(attach).toHaveBeenCalledTimes(1);
  });

  it("uploads multiple photos independently — one failing does not block the others", async () => {
    const upload = vi.fn(async (_v: string, _b: Blob, name: string) => {
      if (name === "bad.jpg") throw new Error("this one fails");
      return { id: `doc-${name}` };
    });
    const attach = vi.fn(async () => {});

    const { result } = renderHook(() =>
      useDamagePhotos("d1", "v1", base({ upload, attach })),
    );

    act(() => result.current.addFiles([jpeg("good.jpg"), jpeg("bad.jpg")]));

    await waitFor(() => {
      const good = result.current.photos.find((p) => p.file.name === "good.jpg");
      expect(good?.status).toBe("attached");
    });
    const bad = result.current.photos.find((p) => p.file.name === "bad.jpg");
    await waitFor(() => expect(bad && result.current.photos.find((p) => p.id === bad.id)?.status).toBe("failed"));
    expect(result.current.hasAttached).toBe(true); // the good one still counts
  });

  it("retries ONLY the attach when upload already succeeded — never re-uploads (no orphan document)", async () => {
    let uploadCalls = 0;
    let attachCalls = 0;
    const upload = vi.fn(async () => {
      uploadCalls += 1;
      return { id: "doc-keep" };
    });
    const attach = vi.fn(async () => {
      attachCalls += 1;
      if (attachCalls < 2) throw new Error("attach dropped");
    });

    const { result } = renderHook(() =>
      useDamagePhotos("d1", "v1", base({ upload, attach })),
    );

    act(() => result.current.addFiles([jpeg("a.jpg")]));

    await waitFor(() => expect(result.current.photos[0]?.status).toBe("attached"));
    expect(uploadCalls).toBe(1); // uploaded exactly once — no orphan
    expect(attachCalls).toBe(2); // attach alone was retried
  });
});
