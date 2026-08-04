import { describe, expect, it } from "vitest";
import { createVehicleSchema, editVehicleSchema } from "./schema";

const validCreate = {
  agency_id: "11111111-1111-4111-8111-111111111111",
  vin: "VF1RFB00066666601",
  registration_plate: "00123-116-16",
  brand: "Renault",
  model: "Clio 5",
  fuel_type: "petrol",
  transmission: "manual",
  initial_mileage: "42350",
};

describe("createVehicleSchema", () => {
  it("parses a valid create body and coerces initial_mileage", () => {
    const parsed = createVehicleSchema.parse(validCreate);
    expect(parsed.initial_mileage).toBe(42350);
    expect(parsed.vin).toBe("VF1RFB00066666601");
  });

  it("rejects a VIN that is not exactly 17 chars", () => {
    expect(() => createVehicleSchema.parse({ ...validCreate, vin: "TOOSHORT" })).toThrow();
  });

  it("rejects an out-of-set fuel type / transmission", () => {
    expect(() => createVehicleSchema.parse({ ...validCreate, fuel_type: "coal" })).toThrow();
    expect(() => createVehicleSchema.parse({ ...validCreate, transmission: "cvt" })).toThrow();
  });

  it("rejects a non-uuid agency", () => {
    expect(() => createVehicleSchema.parse({ ...validCreate, agency_id: "nope" })).toThrow();
  });
});

describe("editVehicleSchema", () => {
  it("parses the mutable subset and normalizes empty optionals", () => {
    const parsed = editVehicleSchema.parse({
      registration_plate: "00123-116-16",
      brand: "Renault",
      model: "Clio 5",
      fuel_type: "petrol",
      transmission: "manual",
      color: "",
      notes: "",
    });
    expect(parsed.color).toBeUndefined();
    expect(parsed.notes).toBeUndefined();
  });

  it("rejects a blank required field", () => {
    expect(() =>
      editVehicleSchema.parse({
        registration_plate: "",
        brand: "Renault",
        model: "Clio 5",
        fuel_type: "petrol",
        transmission: "manual",
      }),
    ).toThrow();
  });
});
