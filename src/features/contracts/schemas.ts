/**
 * Zod validation + payload mappers for the three lifecycle forms (04-03).
 *
 * Encodes the backend rules from wheelio-api `rental_dto.go` request structs +
 * `contract.go` validator tags — NOT the loose transport shape:
 * - activate: `mileage` gte 0 (0 is valid — always send the key), `fuel`
 *   required oneof empty|quarter|half|three_quarters|full; `actual_at` optional.
 * - close: `mileage`+`fuel` as activate, plus `invoice_lines` with min=1; each
 *   line: `description` non-empty, `quantity` gt 0, a DZD amount that maps to
 *   `unit_price_ht_cents` via *100 (INTEGER cents — Pitfall 5), `vat_rate` an
 *   integer percent (e.g. 19) sent as-is.
 * - cancel: `reason` required, non-empty after trim.
 *
 * Validation messages are i18n KEYS (contracts.errors.*), resolved via t() at
 * render in the FieldError boundary (matching customers/schemas.ts) — never a
 * bare string here. `unit_price_ht_cents`/`amount_dzd`: the FORM collects DZD
 * (D-10, human currency); only `toCloseBody` converts to the cents the API
 * wants, so no screen ever hand-rolls the *100.
 */
import { z } from "zod";
import type {
  ActivateBody,
  CloseBody,
  CloseInvoiceLine,
  DepositBody,
} from "@/types/rental";

const fuelLevel = z.enum(
  ["empty", "quarter", "half", "three_quarters", "full"],
  { message: "contracts.errors.fuelRequired" },
);

export const activateSchema = z.object({
  actual_at: z.string().optional(),
  mileage: z.coerce
    .number({ message: "contracts.errors.mileageInvalid" })
    .int({ message: "contracts.errors.mileageInvalid" })
    .gte(0, { message: "contracts.errors.mileageInvalid" }),
  fuel: fuelLevel,
});

/** One invoice line — the DZD amount is converted to cents only in toCloseBody. */
export const lineSchema = z.object({
  description: z
    .string()
    .min(1, { message: "contracts.errors.descriptionRequired" }),
  quantity: z.coerce
    .number({ message: "contracts.errors.quantityInvalid" })
    .int({ message: "contracts.errors.quantityInvalid" })
    .gt(0, { message: "contracts.errors.quantityInvalid" }),
  amount_dzd: z.coerce
    .number({ message: "contracts.errors.amountInvalid" })
    .gte(0, { message: "contracts.errors.amountInvalid" }),
  vat_rate: z.coerce
    .number({ message: "contracts.errors.vatInvalid" })
    .int({ message: "contracts.errors.vatInvalid" })
    .gte(0, { message: "contracts.errors.vatInvalid" }),
});

export const closeSchema = z.object({
  actual_at: z.string().optional(),
  mileage: z.coerce
    .number({ message: "contracts.errors.mileageInvalid" })
    .int({ message: "contracts.errors.mileageInvalid" })
    .gte(0, { message: "contracts.errors.mileageInvalid" }),
  fuel: fuelLevel,
  invoice_lines: z
    .array(lineSchema)
    .min(1, { message: "contracts.errors.invoiceLineRequired" }),
});

export const cancelSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, { message: "contracts.errors.reasonRequired" }),
});

/** Deposit — the human enters DZD (D-10); toDepositBody converts to cents. */
export const depositSchema = z.object({
  amount_dzd: z.coerce
    .number({ message: "contracts.errors.amountInvalid" })
    .gt(0, { message: "contracts.errors.amountInvalid" }),
  method: z.enum(["cash", "card", "transfer"], {
    message: "contracts.errors.amountInvalid",
  }),
});

export type ActivateFormValues = z.infer<typeof activateSchema>;
export type CloseFormValues = z.infer<typeof closeSchema>;
export type CloseLineValues = z.infer<typeof lineSchema>;
export type CancelFormValues = z.infer<typeof cancelSchema>;
export type DepositFormValues = z.infer<typeof depositSchema>;

/** Assemble the activate body, omitting `actual_at` when the field is empty. */
export function toActivateBody(values: ActivateFormValues): ActivateBody {
  return {
    mileage: values.mileage,
    fuel: values.fuel,
    ...(values.actual_at ? { actual_at: values.actual_at } : {}),
  };
}

/**
 * Assemble the close body. Each line's DZD amount becomes INTEGER
 * `unit_price_ht_cents` via `Math.round(amount_dzd * 100)` (Pitfall 5: never
 * send a float cent value); `vat_rate` is an integer percent, forwarded as-is.
 */
export function toCloseBody(values: CloseFormValues): CloseBody {
  return {
    mileage: values.mileage,
    fuel: values.fuel,
    ...(values.actual_at ? { actual_at: values.actual_at } : {}),
    invoice_lines: values.invoice_lines.map(
      (line): CloseInvoiceLine => ({
        description: line.description,
        quantity: line.quantity,
        unit_price_ht_cents: Math.round(line.amount_dzd * 100),
        vat_rate: line.vat_rate,
      }),
    ),
  };
}

/** Assemble the deposit body — DZD amount -> integer `amount_cents`. */
export function toDepositBody(values: DepositFormValues): DepositBody {
  return {
    amount_cents: Math.round(values.amount_dzd * 100),
    method: values.method,
  };
}
