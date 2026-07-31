import { describe, expect, it } from "vitest";
import { creditNoteSchema, fiscalIdentitySchema, paymentSchema } from "./schema";

describe("fiscalIdentitySchema", () => {
  it("accepts a complete identity and normalizes empty optionals", () => {
    const parsed = fiscalIdentitySchema.parse({
      legal_form: "SARL",
      nif: "123",
      nis: "456",
      address_line: "12 rue X",
      tax_article_number: "",
      commerce_register_number: "",
      city: "",
      postal_code: "",
    });
    expect(parsed.legal_form).toBe("SARL");
    expect(parsed.tax_article_number).toBeUndefined();
  });

  it("rejects when a mandatory décret field is blank", () => {
    expect(() =>
      fiscalIdentitySchema.parse({ legal_form: "", nif: "1", nis: "2", address_line: "x" }),
    ).toThrow();
    expect(() =>
      fiscalIdentitySchema.parse({ legal_form: "SARL", nif: "", nis: "2", address_line: "x" }),
    ).toThrow();
  });
});

describe("paymentSchema", () => {
  it("coerces a numeric-string amount and requires it to be positive", () => {
    expect(paymentSchema.parse({ method: "cash", amount_dzd: "5950" }).amount_dzd).toBe(5950);
    expect(() => paymentSchema.parse({ method: "cash", amount_dzd: 0 })).toThrow();
  });

  it("rejects an out-of-set method", () => {
    expect(() => paymentSchema.parse({ method: "crypto", amount_dzd: 10 })).toThrow();
  });
});

describe("creditNoteSchema", () => {
  it("requires a non-empty reason", () => {
    expect(creditNoteSchema.parse({ reason: "Erreur" }).reason).toBe("Erreur");
    expect(() => creditNoteSchema.parse({ reason: "  " })).toThrow();
  });
});
