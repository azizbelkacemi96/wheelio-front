import { describe, expect, it } from "vitest";
import { dayKeyAlgiers, isTodayAlgiers, toRFC3339Algiers } from "./dateAlgiers";

describe("dateAlgiers", () => {
  it("dayKeyAlgiers maps a 23:30 UTC timestamp to the NEXT Algiers day (near-midnight boundary)", () => {
    // 2026-07-28T23:30:00Z is 00:30 on 2026-07-29 in Africa/Algiers (UTC+1).
    // Naive UTC slicing would wrongly report 2026-07-28.
    expect(dayKeyAlgiers("2026-07-28T23:30:00Z")).toBe("2026-07-29");
  });

  it("dayKeyAlgiers keeps a mid-day UTC timestamp on the same Algiers day", () => {
    expect(dayKeyAlgiers("2026-07-28T09:30:00Z")).toBe("2026-07-28");
  });

  it("isTodayAlgiers agrees when the timestamp's Algiers day equals the injected now", () => {
    const now = new Date("2026-07-29T05:00:00Z"); // Algiers day 2026-07-29
    expect(isTodayAlgiers("2026-07-28T23:30:00Z", now)).toBe(true); // also 07-29 Algiers
    expect(isTodayAlgiers("2026-07-28T09:30:00Z", now)).toBe(false); // 07-28 Algiers
  });

  it("toRFC3339Algiers appends seconds and the fixed +01:00 offset", () => {
    expect(toRFC3339Algiers("2026-07-28T09:30")).toBe("2026-07-28T09:30:00+01:00");
  });
});
