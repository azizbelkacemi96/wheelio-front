/**
 * Zod schemas for the billing forms (BILL-01/03/04).
 *
 * Fiscal identity: the PATCH endpoint requires nothing, but the backend gates
 * invoice ISSUANCE on NIF / NIS / legal_form / address_line being non-empty
 * (service.go:100). The form mirrors that as a completeness gate — those four
 * are required here so an admin cannot save an identity that would fail at
 * invoice time; the rest are optional décret niceties.
 */
import { z } from "zod";

const PAYMENT_METHODS = ["cash", "card", "transfer"] as const;

const optional = (v: unknown) => (v === "" || v === null ? undefined : v);

export const fiscalIdentitySchema = z.object({
  legal_form: z.string().trim().min(1, "billing.errors.legalFormRequired"),
  nif: z.string().trim().min(1, "billing.errors.nifRequired"),
  nis: z.string().trim().min(1, "billing.errors.nisRequired"),
  address_line: z.string().trim().min(1, "billing.errors.addressRequired"),
  tax_article_number: z.preprocess(optional, z.string().optional()),
  commerce_register_number: z.preprocess(optional, z.string().optional()),
  city: z.preprocess(optional, z.string().optional()),
  postal_code: z.preprocess(optional, z.string().optional()),
});
export type FiscalIdentityValues = z.infer<typeof fiscalIdentitySchema>;

export const paymentSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  amount_dzd: z.coerce.number().gt(0),
  paid_at: z.preprocess(optional, z.string().optional()),
});
export type PaymentValues = z.infer<typeof paymentSchema>;

export const creditNoteSchema = z.object({
  reason: z.string().trim().min(1, "billing.errors.reasonRequired"),
});
export type CreditNoteValues = z.infer<typeof creditNoteSchema>;

export { PAYMENT_METHODS };
