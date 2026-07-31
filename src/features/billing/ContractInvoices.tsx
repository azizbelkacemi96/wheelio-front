/**
 * The billing block shown on a contract's detail (BILL-02/05): the authenticated
 * contract-PDF download plus the list of invoices issued for the contract, each
 * linking into the invoice detail. Invoices are created by the backend at
 * contract close (RENT-03), so this is empty until then.
 */
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import type { InvoiceStatus } from "@/types/billing";
import { useContractInvoicesQuery } from "./queries";
import { DownloadPdfButton } from "./DownloadPdfButton";
import { contractPdfPath } from "./api";

const STATUS_VARIANT: Record<InvoiceStatus, "default" | "secondary" | "outline" | "destructive"> = {
  issued: "secondary",
  partially_paid: "outline",
  paid: "default",
  voided: "destructive",
};

export function ContractInvoices({ contractId }: { contractId: string }) {
  const { t } = useTranslation();
  const invoicesQuery = useContractInvoicesQuery(contractId);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>{t("billing.contract.invoicesTitle")}</CardTitle>
        <DownloadPdfButton
          path={contractPdfPath(contractId)}
          filename={`contrat-${contractId}.pdf`}
          label={t("billing.contract.downloadContractPdf")}
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {invoicesQuery.isPending ? (
          <Skeleton className="h-10 w-full" />
        ) : invoicesQuery.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {t("billing.contract.invoicesLoadError")}
          </p>
        ) : invoicesQuery.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("billing.contract.noInvoices")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {invoicesQuery.data.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{inv.number}</span>
                  <Badge variant={STATUS_VARIANT[inv.status]}>
                    {t(`billing.invoiceStatus.${inv.status}`)}
                  </Badge>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to="/factures/$invoiceId" params={{ invoiceId: inv.id }}>
                    {t("billing.contract.viewInvoice")}
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
