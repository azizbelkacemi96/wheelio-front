/**
 * Pure Zod tests (no DOM) for customerSchema/driverSchema — covers the
 * per-type domain requiredness and both cross-field refines the plan
 * requires (03-03-PLAN.md Task 1 behavior block).
 */
import { describe, expect, it } from "vitest";
import { customerSchema, driverSchema } from "./schemas";

const baseIndividual = {
  type: "individual" as const,
  full_name: "Yacine Belkacem",
  identity_doc_type: "cin" as const,
};

const baseCompany = {
  type: "company" as const,
  legal_name: "SARL Transport Hamdi",
  rc: "16/00-1234567 B 21",
};

describe("customerSchema — individual", () => {
  it("is INVALID with the cinRequired i18n key on identity_doc_number when cin + empty number", () => {
    const result = customerSchema.safeParse({
      ...baseIndividual,
      identity_doc_number: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path.join(".") === "identity_doc_number",
      );
      expect(issue?.message).toBe("customers.errors.cinRequired");
    }
  });

  it("is VALID with cin + a 1-20 char number", () => {
    const result = customerSchema.safeParse({
      ...baseIndividual,
      identity_doc_number: "123456789012",
    });
    expect(result.success).toBe(true);
  });

  it("is VALID with passport + empty number (passport-optional)", () => {
    const result = customerSchema.safeParse({
      ...baseIndividual,
      identity_doc_type: "passport",
      identity_doc_number: "",
    });
    expect(result.success).toBe(true);
  });

  it("is INVALID when full_name is missing (domain-required)", () => {
    const result = customerSchema.safeParse({
      type: "individual",
      identity_doc_type: "cin",
      identity_doc_number: "123456789012",
    });
    expect(result.success).toBe(false);
  });
});

describe("customerSchema — company", () => {
  it("is INVALID when legal_name is missing (domain-required)", () => {
    const result = customerSchema.safeParse({
      type: "company",
      rc: "16/00-1234567 B 21",
    });
    expect(result.success).toBe(false);
  });

  it("is INVALID when rc is missing (domain-required, pivot)", () => {
    const result = customerSchema.safeParse({
      type: "company",
      legal_name: "SARL Transport Hamdi",
    });
    expect(result.success).toBe(false);
  });

  it("is VALID with legal_name + rc only", () => {
    const result = customerSchema.safeParse(baseCompany);
    expect(result.success).toBe(true);
  });
});

describe("customerSchema — license date order (shared refine)", () => {
  it("is INVALID with the licenseDateOrder key on license_valid_until when valid_until <= issued_at", () => {
    const result = customerSchema.safeParse({
      ...baseIndividual,
      identity_doc_number: "123456789012",
      license_issued_at: "2021-05-10",
      license_valid_until: "2021-05-10",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path.join(".") === "license_valid_until",
      );
      expect(issue?.message).toBe("customers.errors.licenseDateOrder");
    }
  });

  it("is VALID when only one date is present", () => {
    const result = customerSchema.safeParse({
      ...baseIndividual,
      identity_doc_number: "123456789012",
      license_issued_at: "2021-05-10",
    });
    expect(result.success).toBe(true);
  });

  it("is VALID when neither date is present", () => {
    const result = customerSchema.safeParse({
      ...baseIndividual,
      identity_doc_number: "123456789012",
    });
    expect(result.success).toBe(true);
  });

  it("is VALID when license_valid_until is strictly after license_issued_at", () => {
    const result = customerSchema.safeParse({
      ...baseIndividual,
      identity_doc_number: "123456789012",
      license_issued_at: "2021-05-10",
      license_valid_until: "2031-05-10",
    });
    expect(result.success).toBe(true);
  });
});

describe("customerSchema — discriminated union narrowing", () => {
  it("does NOT surface company-only fields when parsing an individual payload", () => {
    const result = customerSchema.safeParse({
      ...baseIndividual,
      identity_doc_number: "123456789012",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("legal_name");
      expect(result.data).not.toHaveProperty("rc");
    }
  });

  it("does NOT surface individual-only fields when parsing a company payload", () => {
    const result = customerSchema.safeParse(baseCompany);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("full_name");
      expect(result.data).not.toHaveProperty("identity_doc_number");
      expect(result.data).not.toHaveProperty("identity_doc_type");
    }
  });
});

describe("driverSchema", () => {
  it("requires a non-empty full_name (<=200)", () => {
    const result = driverSchema.safeParse({
      full_name: "",
      license_number: "AL-2021-004512",
    });
    expect(result.success).toBe(false);

    expect(
      driverSchema.safeParse({
        full_name: "a".repeat(201),
        license_number: "AL-2021-004512",
      }).success,
    ).toBe(false);
  });

  it("requires a non-empty license_number (<=30)", () => {
    const result = driverSchema.safeParse({
      full_name: "Karim Hamdi",
      license_number: "",
    });
    expect(result.success).toBe(false);

    expect(
      driverSchema.safeParse({
        full_name: "Karim Hamdi",
        license_number: "a".repeat(31),
      }).success,
    ).toBe(false);
  });

  it("is VALID with just full_name + license_number", () => {
    const result = driverSchema.safeParse({
      full_name: "Karim Hamdi",
      license_number: "AL-2018-009911",
    });
    expect(result.success).toBe(true);
  });

  it("has its own date-order refine (valid_until must be after issued_at)", () => {
    const invalid = driverSchema.safeParse({
      full_name: "Karim Hamdi",
      license_number: "AL-2018-009911",
      license_issued_at: "2018-02-01",
      license_valid_until: "2018-02-01",
    });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      const issue = invalid.error.issues.find(
        (i) => i.path.join(".") === "license_valid_until",
      );
      expect(issue?.message).toBe("customers.errors.licenseDateOrder");
    }

    const valid = driverSchema.safeParse({
      full_name: "Karim Hamdi",
      license_number: "AL-2018-009911",
      license_issued_at: "2018-02-01",
      license_valid_until: "2028-02-01",
    });
    expect(valid.success).toBe(true);
  });
});
