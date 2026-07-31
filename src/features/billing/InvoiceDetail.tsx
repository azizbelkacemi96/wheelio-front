/**
 * Invoice detail (BILL-02/03/04/05). Shows the invoice with its décret-05-468
 * on-screen mentions (gapless number, issue date, HT/VAT/TTC totals, total in
 * words, per-line HT/VAT), plus the authenticated PDF download (the full legal
 * document with seller/buyer identity), a record-payment form, and an
 * issue-credit-note action.
 *
 * The invoice response carries no payment list and no seller/buyer identity —
 * those live on the PDF. Recording a payment returns the invoice with its
 * status recalculated (issued → partially_paid → paid); issuing a credit note
 * voids it. Action forms are gated on hasOrgRole(scope, "agent") (billing is
 * org-scoped, like customers); the backend re-enforces.
 */
import { useState } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { isHTTPError } from "ky";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { useAuthStore } from "@/shared/auth/store";
import { hasOrgRole } from "@/shared/auth/permissions";
import { useLocale } from "@/shared/i18n/useLocale";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Field, FieldError, FieldLabel } from "@/shared/ui/field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import type { InvoiceResponse, InvoiceStatus } from "@/types/billing";
import { useInvoiceQuery } from "./queries";
import {
  creditNoteErrorKey,
  paymentErrorKey,
  useIssueCreditNote,
  useRecordPayment,
} from "./mutations";
import {
  PAYMENT_METHODS,
  creditNoteSchema,
  paymentSchema,
  type CreditNoteValues,
  type PaymentValues,
} from "./schema";
import { DownloadPdfButton } from "./DownloadPdfButton";
import { invoicePdfPath } from "./api";

const STATUS_VARIANT: Record<InvoiceStatus, "default" | "secondary" | "outline" | "destructive"> = {
  issued: "secondary",
  partially_paid: "outline",
  paid: "default",
  voided: "destructive",
};

function isNotFound(error: unknown): boolean {
  return isHTTPError(error) && error.response.status === 404;
}

export function InvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const scope = useAuthStore((s) => s.scope);
  const mayOperate = scope != null && hasOrgRole(scope, "agent");

  const invoiceQuery = useInvoiceQuery(invoiceId);

  if (invoiceQuery.isPending) return <InvoiceSkeleton />;

  if (invoiceQuery.isError) {
    if (isNotFound(invoiceQuery.error)) {
      return (
        <Screen contractId={undefined}>
          <div className="flex min-h-[40svh] flex-col items-center justify-center gap-2 text-center">
            <h1 className="text-xl font-semibold text-foreground">
              {t("billing.invoice.notFoundHeading")}
            </h1>
            <p className="max-w-sm text-sm text-muted-foreground">
              {t("billing.invoice.notFoundBody")}
            </p>
          </div>
        </Screen>
      );
    }
    return (
      <Screen contractId={undefined}>
        <div className="flex flex-col items-start gap-3 rounded-lg border border-border p-4" role="alert">
          <p className="text-sm text-destructive">{t("billing.invoice.loadError")}</p>
          <Button onClick={() => invoiceQuery.refetch()}>{t("billing.invoice.retry")}</Button>
        </div>
      </Screen>
    );
  }

  const invoice = invoiceQuery.data;
  const formatDzd = (cents: number) => `${(cents / 100).toLocaleString(locale)} DZD`;
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(locale);

  return (
    <Screen contractId={invoice.contract_id}>
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-xl font-semibold text-foreground">
          {t("billing.invoice.title")} {invoice.number}
        </h1>
        <Badge variant={STATUS_VARIANT[invoice.status]}>
          {t(`billing.invoiceStatus.${invoice.status}`)}
        </Badge>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t("billing.invoice.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="divide-y divide-border">
            <Row label={t("billing.invoice.number")} value={invoice.number} />
            <Row label={t("billing.invoice.issuedAt")} value={formatDate(invoice.issued_at)} />
            <Row
              label={t("billing.invoice.status")}
              value={t(`billing.invoiceStatus.${invoice.status}`)}
            />
          </dl>

          <InvoiceLinesTable invoice={invoice} formatDzd={formatDzd} />

          <dl className="ml-auto w-full max-w-xs divide-y divide-border">
            <Row label={t("billing.invoice.totalHt")} value={formatDzd(invoice.total_ht_cents)} numeric />
            <Row label={t("billing.invoice.totalVat")} value={formatDzd(invoice.total_vat_cents)} numeric />
            <Row label={t("billing.invoice.totalTtc")} value={formatDzd(invoice.total_ttc_cents)} numeric />
          </dl>
          {invoice.total_in_words && (
            <p className="text-sm text-muted-foreground">
              {t("billing.invoice.totalInWords")} : {invoice.total_in_words}
            </p>
          )}

          <DownloadPdfButton
            path={invoicePdfPath(invoice.id)}
            filename={`facture-${invoice.number}.pdf`}
            label={t("billing.invoice.downloadPdf")}
          />
        </CardContent>
      </Card>

      {invoice.status === "voided" ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("billing.invoice.voidedNote")}</p>
          </CardContent>
        </Card>
      ) : (
        mayOperate && (
          <>
            {invoice.status !== "paid" && (
              <PaymentCard invoiceId={invoice.id} contractId={invoice.contract_id} />
            )}
            <CreditNoteCard invoiceId={invoice.id} contractId={invoice.contract_id} />
          </>
        )
      )}
    </Screen>
  );
}

// ---- Lines ----

function InvoiceLinesTable({
  invoice,
  formatDzd,
}: {
  invoice: InvoiceResponse;
  formatDzd: (cents: number) => string;
}) {
  const { t } = useTranslation();
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="px-3 py-2">{t("billing.invoice.columns.description")}</TableHead>
            <TableHead className="px-3 py-2 text-right">{t("billing.invoice.columns.quantity")}</TableHead>
            <TableHead className="px-3 py-2 text-right">{t("billing.invoice.columns.unitPriceHt")}</TableHead>
            <TableHead className="px-3 py-2 text-right">{t("billing.invoice.columns.vat")}</TableHead>
            <TableHead className="px-3 py-2 text-right">{t("billing.invoice.columns.lineHt")}</TableHead>
            <TableHead className="px-3 py-2 text-right">{t("billing.invoice.columns.lineVat")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoice.lines.map((line, i) => (
            <TableRow key={i}>
              <TableCell className="px-3 py-2">{line.description}</TableCell>
              <TableCell className="px-3 py-2 text-right">{line.quantity}</TableCell>
              <TableCell className="px-3 py-2 text-right">{formatDzd(line.unit_price_ht_cents)}</TableCell>
              <TableCell className="px-3 py-2 text-right">{line.vat_rate}%</TableCell>
              <TableCell className="px-3 py-2 text-right">{formatDzd(line.line_ht_cents)}</TableCell>
              <TableCell className="px-3 py-2 text-right">{formatDzd(line.line_vat_cents)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---- Payment ----

function PaymentCard({ invoiceId, contractId }: { invoiceId: string; contractId: string }) {
  const { t } = useTranslation();
  const mutation = useRecordPayment(invoiceId, contractId);
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema) as unknown as Resolver<PaymentValues>,
    defaultValues: { method: "cash" },
  });

  const submit = handleSubmit((values) => {
    mutation.mutate(
      {
        method: values.method,
        amount_cents: Math.round(values.amount_dzd * 100),
        paid_at: values.paid_at ? new Date(values.paid_at).toISOString() : undefined,
      },
      { onSuccess: () => reset({ method: "cash", amount_dzd: undefined, paid_at: "" }) },
    );
  });

  const errorKey = paymentErrorKey(mutation.error);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("billing.payment.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field data-invalid={!!errors.method}>
              <FieldLabel htmlFor="payment-method">{t("billing.payment.method")}</FieldLabel>
              <Controller
                control={control}
                name="method"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger id="payment-method" className="w-full" aria-label={t("billing.payment.method")}>
                      <SelectValue placeholder={t("billing.payment.selectPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {t(`billing.method.${m}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field data-invalid={!!errors.amount_dzd}>
              <FieldLabel htmlFor="payment-amount">{t("billing.payment.amount")}</FieldLabel>
              <Input
                id="payment-amount"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                aria-invalid={!!errors.amount_dzd}
                {...register("amount_dzd")}
              />
              <FieldError
                errors={errors.amount_dzd ? [{ message: t("billing.errors.amountInvalid") }] : undefined}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="payment-paid-at">{t("billing.payment.paidAt")}</FieldLabel>
              <Input id="payment-paid-at" type="datetime-local" {...register("paid_at")} />
            </Field>
          </div>

          {errorKey && (
            <p role="alert" className="text-sm text-destructive">
              {t(errorKey)}
            </p>
          )}

          <div>
            <Button type="submit" disabled={mutation.isPending}>
              {t("billing.payment.submit")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ---- Credit note ----

function CreditNoteCard({ invoiceId, contractId }: { invoiceId: string; contractId: string }) {
  const { t } = useTranslation();
  const mutation = useIssueCreditNote(invoiceId, contractId);
  const [issuedNumber, setIssuedNumber] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreditNoteValues>({
    resolver: zodResolver(creditNoteSchema) as unknown as Resolver<CreditNoteValues>,
    defaultValues: { reason: "" },
  });

  const submit = handleSubmit((values) => {
    mutation.mutate(
      { reason: values.reason },
      {
        onSuccess: (cn) => {
          setIssuedNumber(cn.number);
          reset({ reason: "" });
        },
      },
    );
  });

  const errorKey = creditNoteErrorKey(mutation.error);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("billing.creditNote.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {issuedNumber ? (
          <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">
            {t("billing.creditNote.issued", { number: issuedNumber })}
          </p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <Field data-invalid={!!errors.reason}>
              <FieldLabel htmlFor="credit-note-reason">{t("billing.creditNote.reason")}</FieldLabel>
              <Input id="credit-note-reason" aria-invalid={!!errors.reason} {...register("reason")} />
              <FieldError
                errors={errors.reason ? [{ message: t("billing.errors.reasonRequired") }] : undefined}
              />
            </Field>

            {errorKey && (
              <p role="alert" className="text-sm text-destructive">
                {t(errorKey)}
              </p>
            )}

            <div>
              <Button type="submit" variant="outline" disabled={mutation.isPending}>
                {t("billing.creditNote.submit")}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Layout ----

function Screen({ children, contractId }: { children: React.ReactNode; contractId: string | undefined }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 md:p-6">
      {contractId && (
        <Link
          to="/contrats/$contractId"
          params={{ contractId }}
          className="text-sm text-primary hover:underline"
        >
          {t("billing.invoice.backToContract")}
        </Link>
      )}
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  numeric,
}: {
  label: string;
  value: React.ReactNode;
  numeric?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={numeric ? "numeric-cell text-sm text-foreground" : "text-sm text-foreground"}>
        {value}
      </dd>
    </div>
  );
}

function InvoiceSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 md:p-6">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
