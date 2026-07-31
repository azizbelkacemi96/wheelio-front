/**
 * Billing HTTP calls — thin functions over the shared `api` ky client. No
 * second client (inherits /v1 + single-flight refresh). encodeURIComponent
 * every path id (mirrors contracts/api.ts).
 *
 * PDF downloads go through the SAME authenticated client (BILL-05): the token
 * rides the Authorization header, never a bare <a href> query param that would
 * leak it and lack auth. See downloadPdf.
 */
import { api } from "@/shared/api/client";
import type {
  CreditNoteBody,
  CreditNoteResponse,
  FiscalIdentityBody,
  InvoiceResponse,
  OrgFiscalIdentityResponse,
  RecordPaymentBody,
} from "@/types/billing";

function encodeIdSegment(id: string): string {
  return encodeURIComponent(id);
}

export function listContractInvoices(contractId: string): Promise<InvoiceResponse[]> {
  return api
    .get(`rental-contracts/${encodeIdSegment(contractId)}/invoices`)
    .json<InvoiceResponse[]>();
}

export function getInvoice(invoiceId: string): Promise<InvoiceResponse> {
  return api.get(`invoices/${encodeIdSegment(invoiceId)}`).json<InvoiceResponse>();
}

export function recordPayment(
  invoiceId: string,
  body: RecordPaymentBody,
): Promise<InvoiceResponse> {
  return api
    .post(`invoices/${encodeIdSegment(invoiceId)}/payments`, { json: body })
    .json<InvoiceResponse>();
}

export function issueCreditNote(
  invoiceId: string,
  body: CreditNoteBody,
): Promise<CreditNoteResponse> {
  return api
    .post(`invoices/${encodeIdSegment(invoiceId)}/credit-notes`, { json: body })
    .json<CreditNoteResponse>();
}

export function updateFiscalIdentity(
  body: FiscalIdentityBody,
): Promise<OrgFiscalIdentityResponse> {
  return api
    .patch(`organization/fiscal-identity`, { json: body })
    .json<OrgFiscalIdentityResponse>();
}

/**
 * Authenticated PDF download (BILL-05). Fetches the bytes through the ky
 * client (Bearer auth + single-flight refresh), then triggers a browser
 * download from an in-memory object URL — never a bare link, so the token is
 * never exposed and an expired one refreshes transparently.
 */
export async function downloadPdf(path: string, filename: string): Promise<void> {
  const blob = await api.get(path).blob();
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const invoicePdfPath = (invoiceId: string) =>
  `invoices/${encodeIdSegment(invoiceId)}/pdf`;
export const contractPdfPath = (contractId: string) =>
  `rental-contracts/${encodeIdSegment(contractId)}/pdf`;
export const inspectionPdfPath = (inspectionId: string) =>
  `inspections/${encodeIdSegment(inspectionId)}/pdf`;
