/**
 * DTOs mirroring wheelio-api's billing HTTP contract 1:1.
 *
 * Source of truth: `internal/adapter/httpapi/billing_dto.go` (invoiceResponse,
 * paymentResponse, creditNoteResponse, organizationFiscalIdentityResponse +
 * request bodies) and `internal/domain/billing/invoice.go` (InvoiceStatus /
 * Method enum values). Read-only reflection of the backend contract.
 *
 * omitempty rule: every Go `omitempty` field is optional (`?:`) here.
 */

export type InvoiceStatus = "issued" | "partially_paid" | "paid" | "voided";
export type PaymentMethod = "cash" | "card" | "transfer";

export interface InvoiceLine {
  description: string;
  quantity: number;
  unit_price_ht_cents: number;
  vat_rate: number; // integer percent (e.g. 19)
  line_ht_cents: number;
  line_vat_cents: number;
}

export interface InvoiceResponse {
  id: string;
  number: string; // gapless sequential number (décret 05-468)
  status: InvoiceStatus;
  issued_at: string; // RFC3339
  contract_id: string;
  customer_id: string;
  total_ht_cents: number;
  total_vat_cents: number;
  total_ttc_cents: number;
  total_in_words: string; // TTC total spelled out (décret mention)
  lines: InvoiceLine[];
}

export interface PaymentResponse {
  id: string;
  invoice_id: string;
  method: PaymentMethod;
  amount_cents: number;
  stamp_duty_cents: number; // timbre fiscal — computed on cash only
  paid_at: string;
  created_at: string;
}

export interface CreditNoteLine {
  description: string;
  amount_ht_cents: number;
  vat_rate: number;
  vat_cents: number;
}

export interface CreditNoteResponse {
  id: string;
  invoice_id: string;
  number: string;
  lines: CreditNoteLine[];
  total_ht_cents: number;
  total_vat_cents: number;
  total_ttc_cents: number;
  reason: string;
  created_at: string;
}

export interface OrgFiscalIdentityResponse {
  id: string;
  name: string;
  legal_form?: string;
  nif?: string;
  nis?: string;
  tax_article_number?: string;
  commerce_register_number?: string;
  address_line?: string;
  city?: string;
  postal_code?: string;
  updated_at: string;
}

// ---- Request bodies ----

/** POST /invoices/:invoiceID/payments (billing_dto.go:16-20). amount_cents gt=0. */
export interface RecordPaymentBody {
  method: PaymentMethod;
  amount_cents: number;
  paid_at?: string; // RFC3339, optional
}

/** POST /invoices/:invoiceID/credit-notes (billing_dto.go:24-26). */
export interface CreditNoteBody {
  reason: string;
}

/** PATCH /organization/fiscal-identity (billing_dto.go:31-40) — all free text,
 * no field required by the endpoint (incremental entry). The backend gates
 * invoice ISSUANCE (contract close) on NIF/NIS/legal_form/address_line being
 * non-empty (service.go:100), which the UI enforces as a completeness gate. */
export interface FiscalIdentityBody {
  legal_form: string;
  nif: string;
  nis: string;
  tax_article_number: string;
  commerce_register_number: string;
  address_line: string;
  city: string;
  postal_code: string;
}
