/**
 * Billing mutations (BILL-01/03/04). Payment/credit-note both mutate an
 * invoice's derived state, so on success they refresh the invoice detail AND
 * the per-contract list. The fiscal-identity PATCH seeds its own cache from
 * the response (there is no GET endpoint, so the returned identity is the only
 * readback — see FiscalIdentityForm).
 */
import { isHTTPError } from "ky";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  CreditNoteBody,
  FiscalIdentityBody,
  OrgFiscalIdentityResponse,
  RecordPaymentBody,
} from "@/types/billing";
import {
  issueCreditNote,
  recordPayment,
  updateFiscalIdentity,
  uploadOrgLogo,
} from "./api";

export const FISCAL_IDENTITY_KEY = ["billing", "fiscalIdentity"] as const;

export function useRecordPayment(invoiceId: string, contractId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RecordPaymentBody) => recordPayment(invoiceId, body),
    onSuccess: (updated) => {
      queryClient.setQueryData(["billing", "invoices", "detail", invoiceId], updated);
      if (contractId) {
        queryClient.invalidateQueries({
          queryKey: ["billing", "invoices", "byContract", contractId],
        });
      }
    },
  });
}

export function useIssueCreditNote(invoiceId: string, contractId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreditNoteBody) => issueCreditNote(invoiceId, body),
    onSuccess: () => {
      // The invoice is now voided; refetch it and the per-contract list.
      queryClient.invalidateQueries({ queryKey: ["billing", "invoices", "detail", invoiceId] });
      if (contractId) {
        queryClient.invalidateQueries({
          queryKey: ["billing", "invoices", "byContract", contractId],
        });
      }
    },
  });
}

export function useUploadOrgLogo() {
  return useMutation({ mutationFn: (file: File) => uploadOrgLogo(file) });
}

export function useUpdateFiscalIdentity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: FiscalIdentityBody) => updateFiscalIdentity(body),
    onSuccess: (identity: OrgFiscalIdentityResponse) => {
      queryClient.setQueryData(FISCAL_IDENTITY_KEY, identity);
    },
  });
}

function isHTTPStatus(error: unknown, status: number): boolean {
  return isHTTPError(error) && error.response.status === status;
}

/** A payment 400 means an invalid amount (e.g. overpaying the TTC due). */
export function paymentErrorKey(error: unknown): string | null {
  if (isHTTPStatus(error, 400)) return "billing.errors.paymentInvalid";
  return error ? "billing.errors.paymentFailed" : null;
}

/** A credit-note 409 means the invoice is already voided. */
export function creditNoteErrorKey(error: unknown): string | null {
  if (isHTTPStatus(error, 409)) return "billing.errors.alreadyVoided";
  return error ? "billing.errors.creditNoteFailed" : null;
}
