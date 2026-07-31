/**
 * Schema parity with the backend inspection contract (INSP-01). The zod
 * `oneof`s must reject any value outside the exact domain enum sets so a
 * client-invented zone/type/severity can never be POSTed.
 */
import { describe, expect, it } from "vitest";
import { createInspectionSchema, damageSchema } from "./schema";

describe("createInspectionSchema", () => {
  it("accepts a valid body and coerces a numeric-string mileage", () => {
    const parsed = createInspectionSchema.parse({
      kind: "departure",
      mileage: "45230",
      fuel: "three_quarters",
    });
    expect(parsed).toEqual({ kind: "departure", mileage: 45230, fuel: "three_quarters" });
  });

  it("rejects an out-of-set fuel level", () => {
    expect(() =>
      createInspectionSchema.parse({ kind: "departure", mileage: 10, fuel: "reserve" }),
    ).toThrow();
  });

  it("rejects an out-of-set kind", () => {
    expect(() =>
      createInspectionSchema.parse({ kind: "midpoint", mileage: 10, fuel: "full" }),
    ).toThrow();
  });

  it("rejects a negative mileage", () => {
    expect(() =>
      createInspectionSchema.parse({ kind: "return", mileage: -1, fuel: "empty" }),
    ).toThrow();
  });
});

describe("damageSchema", () => {
  it("accepts a valid damage and normalizes empty optionals to undefined", () => {
    const parsed = damageSchema.parse({
      zone: "door_fl",
      damage_type: "scratch",
      severity: "minor",
      position: "",
      description: "",
    });
    expect(parsed).toEqual({
      zone: "door_fl",
      damage_type: "scratch",
      severity: "minor",
      position: undefined,
      description: undefined,
    });
  });

  it("rejects an out-of-set zone", () => {
    expect(() =>
      damageSchema.parse({ zone: "trunk", damage_type: "dent", severity: "severe" }),
    ).toThrow();
  });

  it("rejects an out-of-set damage type and severity", () => {
    expect(() =>
      damageSchema.parse({ zone: "hood", damage_type: "melted", severity: "minor" }),
    ).toThrow();
    expect(() =>
      damageSchema.parse({ zone: "hood", damage_type: "dent", severity: "catastrophic" }),
    ).toThrow();
  });
});
