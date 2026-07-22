import { describe, expect, it } from "vitest";

describe("test harness bootstrap", () => {
  it("runs in a jsdom environment with the MSW server active", () => {
    expect(document).toBeDefined();
    expect(typeof window).toBe("object");
  });
});
