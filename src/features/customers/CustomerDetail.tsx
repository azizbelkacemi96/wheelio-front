/**
 * Customer detail screen (CUST-01/02/03, D-05).
 *
 * Composes the 03-01 read hooks IN PARALLEL — useCustomerQuery +
 * useCustomerDriversQuery — with NO waterfall: the drivers query is
 * unconditional (an individual customer just returns [] from the backend,
 * one cheap request) and the drivers SECTION is rendered only once the
 * customer's `type` resolves to "company" (mirrors VehicleDetail's
 * unconditional active-contract query, never inferred from another field).
 * The two queries fail independently: a drivers-query error shows an
 * inline banner INSIDE the drivers card and must not blank the page, which
 * loaded fine.
 *
 * Optional fields are omitempty-ABSENT JSON keys (not null), except the two
 * license date fields which may also be `null` — every one is
 * presence-guarded before any formatting call. Every label flows through
 * i18n (D-06); raw data values render directly via React JSX auto-escaping.
 *
 * The backend deliberately 404s BOTH nonexistent and out-of-scope customers,
 * so a 404 renders one generic not-found state — never an access-denied
 * variant that would confirm existence (threat T-03-11).
 *
 * Scope fence: NO contract history (Phase 4), NO edit/delete affordances —
 * this screen shows only what the customer/driver endpoints expose.
 */
import { isHTTPError } from "ky";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { useLocale } from "@/shared/i18n/useLocale";
import type { Locale } from "@/shared/i18n/useLocale";
import type { CustomerResponse, DriverResponse } from "@/types/customer";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { Separator } from "@/shared/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { CustomerTypeBadge } from "./CustomerTypeBadge";
import { useCustomerDriversQuery, useCustomerQuery } from "./queries";

function isNotFound(error: unknown): boolean {
  return isHTTPError(error) && error.response.status === 404;
}

/** Parses a YYYY-MM-DD date-only string as a local calendar date (no UTC
 * shift risk from `new Date(dateOnlyString)`). */
function formatDate(dateOnly: string, locale: Locale): string {
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(locale);
}

function displayName(customer: CustomerResponse): string {
  return customer.type === "company"
    ? (customer.legal_name ?? "")
    : (customer.full_name ?? "");
}

export function CustomerDetail({ customerId }: { customerId: string }) {
  const { t } = useTranslation();
  const { locale } = useLocale();

  // Two parallel queries — no conditional/waterfall between them.
  const customerQuery = useCustomerQuery(customerId);
  const driversQuery = useCustomerDriversQuery(customerId);

  if (customerQuery.isPending) {
    return <CustomerDetailSkeleton />;
  }

  if (customerQuery.isError) {
    if (isNotFound(customerQuery.error)) {
      return <NotFoundState />;
    }
    return (
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <BackLink />
        <div
          className="flex flex-col items-start gap-3 rounded-lg border border-border p-4"
          role="alert"
        >
          <p className="text-sm text-destructive">{t("customers.loadError")}</p>
          <Button onClick={() => customerQuery.refetch()}>
            {t("customers.retry")}
          </Button>
        </div>
      </div>
    );
  }

  const customer = customerQuery.data;

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <BackLink />

      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-xl font-semibold text-foreground">
            {displayName(customer)}
          </h1>
          <CustomerTypeBadge type={customer.type} />
        </div>
      </header>

      {customer.type === "company" ? (
        <>
          <CompanyCard customer={customer} />
          <DriversCard query={driversQuery} locale={locale} />
        </>
      ) : (
        <>
          <IndividualCard customer={customer} />
          <LicenseCard customer={customer} locale={locale} />
        </>
      )}
    </div>
  );
}

function BackLink() {
  const { t } = useTranslation();
  return (
    <Link to="/clients" className="text-sm text-primary hover:underline">
      {t("customers.detail.backToList")}
    </Link>
  );
}

/** A single label/value row — value renders raw (auto-escaped by React). */
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

function IndividualCard({ customer }: { customer: CustomerResponse }) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("customers.detail.identityTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y divide-border">
          {customer.full_name !== undefined && (
            <DetailRow
              label={t("customers.fields.fullName")}
              value={customer.full_name}
            />
          )}
          {customer.identity_doc_type !== undefined && (
            <DetailRow
              label={t("customers.fields.identityDocType")}
              value={t(`customers.identityDocType.${customer.identity_doc_type}`)}
            />
          )}
          {customer.identity_doc_number !== undefined && (
            <DetailRow
              label={t("customers.fields.identityDocNumber")}
              value={customer.identity_doc_number}
            />
          )}
          {customer.phone !== undefined && (
            <DetailRow label={t("customers.fields.phone")} value={customer.phone} />
          )}
          {customer.address !== undefined && (
            <DetailRow
              label={t("customers.fields.address")}
              value={customer.address}
            />
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

function hasLicenseData(customer: CustomerResponse): boolean {
  return (
    customer.license_number !== undefined ||
    customer.license_issued_at != null ||
    customer.license_valid_until != null
  );
}

function LicenseCard({
  customer,
  locale,
}: {
  customer: CustomerResponse;
  locale: Locale;
}) {
  const { t } = useTranslation();

  if (!hasLicenseData(customer)) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("customers.detail.licenseTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y divide-border">
          {customer.license_number !== undefined && (
            <DetailRow
              label={t("customers.fields.licenseNumber")}
              value={customer.license_number}
            />
          )}
          {customer.license_issued_at != null && (
            <DetailRow
              label={t("customers.fields.licenseIssuedAt")}
              value={formatDate(customer.license_issued_at, locale)}
            />
          )}
          {customer.license_valid_until != null && (
            <DetailRow
              label={t("customers.fields.licenseValidUntil")}
              value={formatDate(customer.license_valid_until, locale)}
            />
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

function CompanyCard({ customer }: { customer: CustomerResponse }) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("customers.detail.companyTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y divide-border">
          {customer.legal_name !== undefined && (
            <DetailRow
              label={t("customers.fields.legalName")}
              value={customer.legal_name}
            />
          )}
          {customer.rc !== undefined && (
            <DetailRow label={t("customers.fields.rc")} value={customer.rc} />
          )}
          {customer.nif !== undefined && (
            <DetailRow label={t("customers.fields.nif")} value={customer.nif} />
          )}
          {customer.nis !== undefined && (
            <DetailRow label={t("customers.fields.nis")} value={customer.nis} />
          )}
          {customer.phone !== undefined && (
            <DetailRow label={t("customers.fields.phone")} value={customer.phone} />
          )}
          {customer.address !== undefined && (
            <DetailRow
              label={t("customers.fields.address")}
              value={customer.address}
            />
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

function DriversCard({
  query,
  locale,
}: {
  query: ReturnType<typeof useCustomerDriversQuery>;
  locale: Locale;
}) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("customers.detail.driversTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <DriversCardBody query={query} locale={locale} />
      </CardContent>
    </Card>
  );
}

function DriversCardBody({
  query,
  locale,
}: {
  query: ReturnType<typeof useCustomerDriversQuery>;
  locale: Locale;
}) {
  const { t } = useTranslation();

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-2" data-testid="drivers-loading">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
      </div>
    );
  }

  // A drivers-only error stays INSIDE the card — the page is not blanked.
  if (query.isError) {
    return (
      <div className="flex flex-col items-start gap-3" role="alert">
        <p className="text-sm text-destructive">
          {t("customers.detail.driversLoadError")}
        </p>
        <Button size="sm" onClick={() => query.refetch()}>
          {t("customers.retry")}
        </Button>
      </div>
    );
  }

  const drivers = query.data;
  if (drivers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("customers.drivers.empty")}</p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {drivers.map((driver) => (
        <DriverRow key={driver.id} driver={driver} locale={locale} />
      ))}
    </ul>
  );
}

function DriverRow({ driver, locale }: { driver: DriverResponse; locale: Locale }) {
  const { t } = useTranslation();

  return (
    <li className="flex flex-col gap-1 py-2">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium text-foreground">
          {driver.full_name}
        </span>
        <span className="text-sm text-muted-foreground">
          {driver.license_number}
        </span>
      </div>
      {(driver.license_issued_at != null || driver.license_valid_until != null) && (
        <dl className="flex flex-col gap-0.5">
          {driver.license_issued_at != null && (
            <DetailRow
              label={t("customers.fields.licenseIssuedAt")}
              value={formatDate(driver.license_issued_at, locale)}
            />
          )}
          {driver.license_valid_until != null && (
            <DetailRow
              label={t("customers.fields.licenseValidUntil")}
              value={formatDate(driver.license_valid_until, locale)}
            />
          )}
        </dl>
      )}
    </li>
  );
}

function NotFoundState() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <BackLink />
      <div className="flex min-h-[40svh] flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-xl font-semibold text-foreground">
          {t("customers.detail.notFoundHeading")}
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t("customers.detail.notFoundBody")}
        </p>
      </div>
    </div>
  );
}

function CustomerDetailSkeleton() {
  return (
    <div
      className="flex flex-col gap-4 p-4 md:p-6"
      data-testid="customer-detail-loading"
    >
      <Skeleton className="h-5 w-40" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-5 w-72" />
      </div>
      <Separator />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
