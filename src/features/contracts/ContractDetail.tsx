/**
 * Contract detail screen (RENT-02/03/04, D-03/D-09).
 *
 * `contractResponse` carries only vehicle_id/customer_id UUIDs and — crucially
 * — NO agency_id (04-RESEARCH.md backend reality). So the screen composes the
 * contract with a SEPARATE vehicle fetch (for the plate AND the `canOperate`
 * agency gate) and a customer fetch (for the name). The two dependent queries
 * are gated on the loaded contract (`enabled: !!contract`) rather than a blind
 * waterfall, and each fails INDEPENDENTLY: a vehicle/customer error stays
 * inline and never blanks the contract card, which loaded fine (mirrors
 * VehicleDetail's independent-error shape).
 *
 * Action buttons are gated on BOTH the domain transition matrix AND the agency
 * axis: `mayOperate = scope != null && vehicle !== undefined &&
 * canOperate(scope, vehicle.agency_id)` — the agency_id is read from the
 * VEHICLE, never from the contract (it isn't there), and this is `canOperate`
 * (per-agency), NOT `hasOrgRole`. Activate shows only when reserved, Close only
 * when active, Cancel when reserved|active; closed/cancelled show none. On a
 * successful action the mutation invalidates ['contracts'] so this query
 * refetches and the buttons re-gate to the new status; a stale-UI 409 inside a
 * form does the same via its own detail invalidation (T-04-05).
 *
 * A 404 on the contract renders one generic not-found state (never an
 * access-denied variant that would confirm existence — T-04-07). Every label
 * flows through i18n; raw data (plate, customer name) renders via JSX escaping.
 */
import { useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { isHTTPError } from "ky";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { ClipboardCheck, FileCheck2, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/useLocale";
import type { Locale } from "@/shared/i18n/useLocale";
import type { ContractResponse } from "@/types/rental";
import type { VehicleResponse } from "@/types/fleet";
import type { CustomerResponse } from "@/types/customer";
import { useAuthStore } from "@/shared/auth/store";
import { canOperate } from "@/shared/auth/permissions";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { Separator } from "@/shared/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { useVehicleQuery } from "@/features/fleet/queries";
import { useCustomerQuery } from "@/features/customers/queries";
import { ContractInvoices } from "@/features/billing/ContractInvoices";
import { ContractStatusBadge } from "./ContractStatusBadge";
import { RentalStepper } from "./RentalStepper";
import { useContractQuery } from "./queries";
import { ActivateForm } from "./forms/ActivateForm";
import { CloseForm } from "./forms/CloseForm";
import { CancelForm } from "./forms/CancelForm";
import { DepositForm } from "./forms/DepositForm";

type OpenForm = "activate" | "close" | "cancel" | "deposit" | null;

function isNotFound(error: unknown): boolean {
  return isHTTPError(error) && error.response.status === 404;
}

function customerName(customer: CustomerResponse): string | undefined {
  return customer.legal_name ?? customer.full_name;
}

export function ContractDetail({ contractId }: { contractId: string }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const scope = useAuthStore((s) => s.scope);
  const [openForm, setOpenForm] = useState<OpenForm>(null);

  const contractQuery = useContractQuery(contractId);
  const contract = contractQuery.data;

  // Dependent queries — gated on the loaded contract, no blind waterfall.
  const vehicleQuery = useVehicleQuery(contract?.vehicle_id ?? "", {
    enabled: !!contract,
  });
  const customerQuery = useCustomerQuery(contract?.customer_id ?? "", {
    enabled: !!contract,
  });

  if (contractQuery.isPending) {
    return <ContractDetailSkeleton />;
  }

  if (contractQuery.isError) {
    if (isNotFound(contractQuery.error)) {
      return <NotFoundState />;
    }
    return (
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <BackLink />
        <div
          className="flex flex-col items-start gap-3 rounded-lg border border-border p-4"
          role="alert"
        >
          <p className="text-sm text-destructive">{t("contracts.loadError")}</p>
          <Button onClick={() => contractQuery.refetch()}>
            {t("contracts.retry")}
          </Button>
        </div>
      </div>
    );
  }

  const loadedContract = contractQuery.data;
  const vehicle = vehicleQuery.data;
  const customer = customerQuery.data;

  // Agency gate: canOperate on the VEHICLE'S agency_id (never the contract's).
  const mayOperate =
    scope != null && vehicle !== undefined && canOperate(scope, vehicle.agency_id);

  const status = loadedContract.status;
  const showActivate = status === "reserved" && mayOperate;
  const showClose = status === "active" && mayOperate;
  const showCancel = (status === "reserved" || status === "active") && mayOperate;
  const showDeposit =
    (status === "reserved" || status === "active") && mayOperate;
  // État des lieux (Phase 5): a departure/return inspection can be run while
  // the contract is reserved or active (inspection status is decoupled from
  // contract status). Links out to the contract-scoped capture screen.
  const showInspection =
    (status === "reserved" || status === "active") && mayOperate;

  const closeOpenForm = () => setOpenForm(null);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <BackLink />

      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-xl font-semibold text-foreground">
            {t("contracts.detail.title")}
          </h1>
          <ContractStatusBadge status={status} />
        </div>
      </header>

      {/* Lifecycle stepper — the user always knows the current stage. */}
      <RentalStepper status={status} />

      {/* Guided check-out (départ) / check-in (retour): the handover reads as an
          ordered ritual — état des lieux first, then the km/fuel record that
          flips the status — mirroring how rental tools sequence the counter. */}
      {(status === "reserved" || status === "active") && mayOperate && (
        <Card>
          <CardHeader>
            <CardTitle>
              {status === "reserved"
                ? t("contracts.detail.checkout.title")
                : t("contracts.detail.checkin.title")}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {status === "reserved"
                ? t("contracts.detail.checkout.subtitle")
                : t("contracts.detail.checkin.subtitle")}
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ol className="flex flex-col gap-2">
              {showInspection && (
                <GuidedStep
                  index={1}
                  icon={ClipboardCheck}
                  label={t(
                    status === "reserved"
                      ? "contracts.detail.checkout.inspection.label"
                      : "contracts.detail.checkin.inspection.label",
                  )}
                  desc={t(
                    status === "reserved"
                      ? "contracts.detail.checkout.inspection.desc"
                      : "contracts.detail.checkin.inspection.desc",
                  )}
                >
                  <Button asChild variant="outline" size="sm">
                    <Link to="/etats-des-lieux/$contractId" params={{ contractId }}>
                      {t("contracts.actions.inspection")}
                    </Link>
                  </Button>
                </GuidedStep>
              )}
              <GuidedStep
                index={showInspection ? 2 : 1}
                icon={status === "reserved" ? KeyRound : FileCheck2}
                label={t(
                  status === "reserved"
                    ? "contracts.detail.checkout.record.label"
                    : "contracts.detail.checkin.record.label",
                )}
                desc={t(
                  status === "reserved"
                    ? "contracts.detail.checkout.record.desc"
                    : "contracts.detail.checkin.record.desc",
                )}
                highlight
              >
                {showActivate && (
                  <Button
                    size="sm"
                    onClick={() => setOpenForm((f) => (f === "activate" ? null : "activate"))}
                  >
                    {t("contracts.actions.activate")}
                  </Button>
                )}
                {showClose && (
                  <Button
                    size="sm"
                    onClick={() => setOpenForm((f) => (f === "close" ? null : "close"))}
                  >
                    {t("contracts.actions.close")}
                  </Button>
                )}
              </GuidedStep>
            </ol>

            {openForm === "activate" && showActivate && (
              <ActivateForm contract={loadedContract} onDone={closeOpenForm} />
            )}
            {openForm === "close" && showClose && (
              <CloseForm
                contract={loadedContract}
                onDone={closeOpenForm}
                defaultClassId={vehicle?.class_id}
              />
            )}

            <Separator />

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">
                {t("contracts.detail.otherActions")}
              </span>
              <div className="flex flex-wrap gap-2">
                {showDeposit && (
                  <Button
                    variant="outline"
                    onClick={() => setOpenForm((f) => (f === "deposit" ? null : "deposit"))}
                  >
                    {t("contracts.actions.recordDeposit")}
                  </Button>
                )}
                {showCancel && (
                  <Button
                    variant="outline"
                    onClick={() => setOpenForm((f) => (f === "cancel" ? null : "cancel"))}
                  >
                    {t("contracts.actions.cancel")}
                  </Button>
                )}
              </div>
              {openForm === "deposit" && showDeposit && (
                <DepositForm contract={loadedContract} onDone={closeOpenForm} />
              )}
              {openForm === "cancel" && showCancel && (
                <CancelForm contract={loadedContract} onDone={closeOpenForm} />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {status === "closed" && (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {t("contracts.detail.closedNote")}
        </div>
      )}

      <ContractInfoCard
        contract={loadedContract}
        vehicle={vehicle}
        vehicleError={vehicleQuery.isError}
        customer={customer}
        customerError={customerQuery.isError}
        locale={locale}
      />

      {/* Billing block (BILL-02/05): contract PDF + issued invoices. */}
      <ContractInvoices contractId={contractId} />
    </div>
  );
}

function BackLink() {
  const { t } = useTranslation();
  return (
    <Link to="/contrats" className="text-sm text-primary hover:underline">
      {t("contracts.actions.backToList")}
    </Link>
  );
}

/** One numbered row in the guided check-out/check-in list: a step number, an
 * icon + label + one-line description, and the step's action on the right.
 * `highlight` marks the status-changing step (the emphasized primary). */
function GuidedStep({
  index,
  icon: Icon,
  label,
  desc,
  highlight = false,
  children,
}: {
  index: number;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  desc: string;
  highlight?: boolean;
  children: ReactNode;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3",
        highlight ? "border-primary/40 bg-primary/5" : "border-border",
      )}
    >
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          highlight ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {index}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Icon className="size-3.5 shrink-0 opacity-70" aria-hidden={true} />
          {label}
        </p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </li>
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

function ContractInfoCard({
  contract,
  vehicle,
  vehicleError,
  customer,
  customerError,
  locale,
}: {
  contract: ContractResponse;
  vehicle: VehicleResponse | undefined;
  vehicleError: boolean;
  customer: CustomerResponse | undefined;
  customerError: boolean;
  locale: Locale;
}) {
  const { t } = useTranslation();
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(locale);
  const formatMileage = (km: number) => `${km.toLocaleString(locale)} km`;
  const formatDzd = (cents: number) =>
    `${(cents / 100).toLocaleString(locale)} DZD`;

  const vehicleValue = vehicle
    ? vehicleLabel(vehicle)
    : vehicleError
      ? t("contracts.detail.vehicleUnavailable")
      : "…";
  const customerValue = customer
    ? (customerName(customer) ?? t("contracts.detail.customerUnavailable"))
    : customerError
      ? t("contracts.detail.customerUnavailable")
      : "…";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("contracts.detail.infoTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y divide-border">
          <DetailRow label={t("contracts.detail.vehicle")} value={vehicleValue} />
          <DetailRow label={t("contracts.detail.customer")} value={customerValue} />
          <DetailRow
            label={t("contracts.detail.period")}
            value={`${formatDate(contract.starts_at)} → ${formatDate(contract.ends_at)}`}
          />
          <DetailRow
            label={t("contracts.detail.status")}
            value={<ContractStatusBadge status={contract.status} />}
          />
          {/* Every optional field is an omitempty-ABSENT key — presence-guard. */}
          {contract.deposit_amount_cents !== undefined && (
            <DetailRow
              label={t("contracts.detail.deposit")}
              value={
                <span className="numeric-cell">
                  {formatDzd(contract.deposit_amount_cents)}
                </span>
              }
            />
          )}
          {contract.departure_mileage !== undefined && (
            <DetailRow
              label={t("contracts.detail.departureMileage")}
              value={
                <span className="numeric-cell">
                  {formatMileage(contract.departure_mileage)}
                </span>
              }
            />
          )}
          {contract.departure_fuel_level !== undefined && (
            <DetailRow
              label={t("contracts.detail.departureFuel")}
              value={t(`vehicles.fuelLevel.${contract.departure_fuel_level}`)}
            />
          )}
          {contract.return_mileage !== undefined && (
            <DetailRow
              label={t("contracts.detail.returnMileage")}
              value={
                <span className="numeric-cell">
                  {formatMileage(contract.return_mileage)}
                </span>
              }
            />
          )}
          {contract.return_fuel_level !== undefined && (
            <DetailRow
              label={t("contracts.detail.returnFuel")}
              value={t(`vehicles.fuelLevel.${contract.return_fuel_level}`)}
            />
          )}
          {contract.cancel_reason !== undefined && (
            <DetailRow
              label={t("contracts.detail.cancelReason")}
              value={contract.cancel_reason}
            />
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

function vehicleLabel(v: VehicleResponse): string {
  return `${v.registration_plate} — ${v.brand} ${v.model}`;
}

function NotFoundState() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <BackLink />
      <div className="flex min-h-[40svh] flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-xl font-semibold text-foreground">
          {t("contracts.detail.notFoundHeading")}
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t("contracts.detail.notFoundBody")}
        </p>
      </div>
    </div>
  );
}

function ContractDetailSkeleton() {
  return (
    <div
      className="flex flex-col gap-4 p-4 md:p-6"
      data-testid="contract-detail-loading"
    >
      <Skeleton className="h-5 w-40" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
      </div>
      <Separator />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
