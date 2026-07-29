/**
 * Zod validation + DZD->cents mapping for the lifecycle forms (04-03 Task 1).
 *
 * The backend rules encoded here (rental_dto.go / contract.go validator tags):
 * activate/close mileage gte 0, close needs min=1 invoice lines, each line
 * quantity gt 0 and a DZD amount converted to INTEGER cents (*100), vat_rate
 * an integer percent sent as-is, cancel needs a non-empty trimmed reason.
 * Validation messages are i18n KEYS (contracts.errors.*), never bare strings.
 */
import { describe, expect, it } from "vitest";
import {
  activateSchema,
  cancelSchema,
  closeSchema,
  toActivateBody,
  toCloseBody,
} from "./schemas";

describe("activateSchema", () => {
  it("accepts mileage 0 (gte 0) with a fuel level", () => {
    const parsed = activateSchema.parse({ mileage: "0", fuel: "full" });
    expect(parsed.mileage).toBe(0);
    expect(parsed.fuel).toBe("full");
  });

  it("coerces a numeric string mileage to an integer", () => {
    expect(activateSchema.parse({ mileage: "12345", fuel: "half" }).mileage).toBe(
      12345,
    );
  });

  it("rejects a negative mileage", () => {
    const result = activateSchema.safeParse({ mileage: "-1", fuel: "full" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing/invalid fuel level", () => {
    expect(
      activateSchema.safeParse({ mileage: "10", fuel: "diesel" }).success,
    ).toBe(false);
  });

  it("toActivateBody drops actual_at when absent and keeps mileage+fuel", () => {
    const body = toActivateBody(activateSchema.parse({ mileage: "10", fuel: "quarter" }));
    expect(body).toEqual({ mileage: 10, fuel: "quarter" });
    expect("actual_at" in body).toBe(false);
  });
});

describe("closeSchema", () => {
  const oneLine = {
    mileage: "16050",
    fuel: "half",
    invoice_lines: [
      { description: "Location 7 jours", quantity: "1", amount_dzd: "35000", vat_rate: "19" },
    ],
  };

  it("requires at least one invoice line (invoiceLineRequired)", () => {
    const result = closeSchema.safeParse({
      mileage: "100",
      fuel: "full",
      invoice_lines: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (i) => i.message === "contracts.errors.invoiceLineRequired",
        ),
      ).toBe(true);
    }
  });

  it("accepts a single valid line", () => {
    expect(closeSchema.safeParse(oneLine).success).toBe(true);
  });

  it("rejects a line with quantity 0 (gt 0)", () => {
    const result = closeSchema.safeParse({
      ...oneLine,
      invoice_lines: [{ ...oneLine.invoice_lines[0], quantity: "0" }],
    });
    expect(result.success).toBe(false);
  });

  it("toCloseBody converts a DZD amount to INTEGER cents (*100) and keeps vat_rate as-is", () => {
    const body = toCloseBody(closeSchema.parse(oneLine));
    expect(body.invoice_lines).toHaveLength(1);
    const line = body.invoice_lines[0];
    // 35000 DZD -> 3_500_000 cents.
    expect(line.unit_price_ht_cents).toBe(3_500_000);
    expect(Number.isInteger(line.unit_price_ht_cents)).toBe(true);
    expect(line.vat_rate).toBe(19);
    expect(line.quantity).toBe(1);
    expect(line.description).toBe("Location 7 jours");
  });

  it("rounds a fractional DZD amount to the nearest integer cent", () => {
    const body = toCloseBody(
      closeSchema.parse({
        ...oneLine,
        invoice_lines: [{ ...oneLine.invoice_lines[0], amount_dzd: "12.345" }],
      }),
    );
    // 12.345 * 100 = 1234.5 -> rounds to 1235.
    expect(body.invoice_lines[0].unit_price_ht_cents).toBe(1235);
  });
});

describe("cancelSchema", () => {
  it("requires a non-empty trimmed reason (reasonRequired)", () => {
    const result = cancelSchema.safeParse({ reason: "   " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (i) => i.message === "contracts.errors.reasonRequired",
        ),
      ).toBe(true);
    }
  });

  it("accepts and trims a real reason", () => {
    expect(cancelSchema.parse({ reason: "  Client absent  " }).reason).toBe(
      "Client absent",
    );
  });
});
