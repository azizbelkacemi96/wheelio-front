import { describe, expect, it } from "vitest";
import { STEP_FIELDS, wizardSchema } from "./schema";

const base = {
  vehicle_id: "11111111-1111-4111-8111-111111111111",
  customer_id: "22222222-2222-4222-8222-222222222222",
  starts_at_local: "2026-07-01T09:00",
  ends_at_local: "2026-07-05T09:00",
  departure_mileage: "12000",
  departure_fuel: "full",
  activate_now: true,
};

describe("wizardSchema", () => {
  it("accepts a full valid payload and coerces mileage to an int", () => {
    const parsed = wizardSchema.parse(base);
    expect(parsed.departure_mileage).toBe(12000);
    expect(parsed.vehicle_id).toBe(base.vehicle_id);
  });

  it("rejects an end date that is not strictly after the start", () => {
    const result = wizardSchema.safeParse({
      ...base,
      ends_at_local: "2026-07-01T09:00",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("contracts.errors.endBeforeStart");
      expect(result.error.issues[0].path).toEqual(["ends_at_local"]);
    }
  });

  it("treats deposit as optional — a payload with no deposit is valid", () => {
    const result = wizardSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deposit_amount).toBeUndefined();
      expect(result.data.deposit_method).toBeUndefined();
    }
  });

  it("accepts a deposit amount + method when provided", () => {
    const parsed = wizardSchema.parse({
      ...base,
      deposit_amount: "5000",
      deposit_method: "cash",
    });
    expect(parsed.deposit_amount).toBe(5000);
    expect(parsed.deposit_method).toBe("cash");
  });

  it("normalizes an empty-string deposit amount to undefined (untouched field)", () => {
    const parsed = wizardSchema.parse({ ...base, deposit_amount: "", deposit_method: "" });
    expect(parsed.deposit_amount).toBeUndefined();
    expect(parsed.deposit_method).toBeUndefined();
  });

  it("STEP_FIELDS maps the four steps to their gating fields", () => {
    expect(STEP_FIELDS).toHaveLength(4);
    expect(STEP_FIELDS[0]).toEqual(["vehicle_id"]);
    expect(STEP_FIELDS[2]).toEqual(["starts_at_local", "ends_at_local"]);
    expect(STEP_FIELDS[3]).toEqual(["departure_mileage", "departure_fuel"]);
  });
});
