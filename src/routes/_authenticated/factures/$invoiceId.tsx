import { createFileRoute } from "@tanstack/react-router";
import { InvoiceDetail } from "@/features/billing/InvoiceDetail";

/**
 * /factures/$invoiceId — invoice detail (BILL-02/03/04/05). Reached from a
 * contract's invoices list. The id comes from the path param and is forwarded
 * to InvoiceDetail, which composes the invoice + payment/credit-note actions +
 * authenticated PDF download.
 */
export const Route = createFileRoute("/_authenticated/factures/$invoiceId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { invoiceId } = Route.useParams();
  return <InvoiceDetail invoiceId={invoiceId} />;
}
