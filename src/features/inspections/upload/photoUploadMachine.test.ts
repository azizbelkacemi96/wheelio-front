/**
 * Pure state-machine helpers (INSP-02). No React, no network.
 */
import { describe, expect, it } from "vitest";
import {
  MAX_AUTO_ATTEMPTS,
  backoffMs,
  isAttached,
  isInFlight,
  resumeStatus,
  type PhotoItem,
} from "./photoUploadMachine";

function item(overrides: Partial<PhotoItem> = {}): PhotoItem {
  return {
    id: "p1",
    file: new File(["x"], "a.jpg", { type: "image/jpeg" }),
    previewUrl: "",
    status: "queued",
    attempts: 0,
    ...overrides,
  };
}

describe("backoffMs", () => {
  it("grows with the attempt and stays bounded at 8s (+jitter)", () => {
    expect(backoffMs(1)).toBeGreaterThanOrEqual(2000);
    expect(backoffMs(1)).toBeLessThan(2000 + 250 + 1);
    // caps: 2^10 * 1000 would be huge but is clamped to 8000 (+<=250 jitter).
    expect(backoffMs(10)).toBeLessThanOrEqual(8000 + 250);
    expect(backoffMs(10)).toBeGreaterThanOrEqual(8000);
  });
});

describe("predicates", () => {
  it("isAttached only for the attached status", () => {
    expect(isAttached(item({ status: "attached" }))).toBe(true);
    expect(isAttached(item({ status: "uploaded" }))).toBe(false);
    expect(isAttached(item({ status: "failed" }))).toBe(false);
  });

  it("isInFlight for every non-terminal status", () => {
    expect(isInFlight(item({ status: "queued" }))).toBe(true);
    expect(isInFlight(item({ status: "uploading" }))).toBe(true);
    expect(isInFlight(item({ status: "attached" }))).toBe(false);
    expect(isInFlight(item({ status: "failed" }))).toBe(false);
  });

  it("resumeStatus skips to the attach leg when a document was already uploaded", () => {
    expect(resumeStatus(item())).toBe("queued");
    expect(resumeStatus(item({ documentId: "doc1" }))).toBe("uploaded");
  });
});

it("MAX_AUTO_ATTEMPTS is a small positive bound", () => {
  expect(MAX_AUTO_ATTEMPTS).toBeGreaterThan(1);
  expect(MAX_AUTO_ATTEMPTS).toBeLessThanOrEqual(5);
});
