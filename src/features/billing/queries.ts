/**
 * Billing read layer — TanStack Query hooks over api.ts. Keys namespaced
 * ["billing", ...]. Invoices are per-contract (there is no org-wide invoice
 * list endpoint); the detail view is keyed by invoice id.
 */
import { useQuery } from "@tanstack/react-query";
import { getInvoice, listContractInvoices } from "./api";

export function useContractInvoicesQuery(contractId: string, enabled = true) {
  return useQuery({
    queryKey: ["billing", "invoices", "byContract", contractId],
    queryFn: () => listContractInvoices(contractId),
    enabled: enabled && contractId !== "",
  });
}

export function useInvoiceQuery(invoiceId: string) {
  return useQuery({
    queryKey: ["billing", "invoices", "detail", invoiceId],
    queryFn: () => getInvoice(invoiceId),
    enabled: invoiceId !== "",
  });
}
