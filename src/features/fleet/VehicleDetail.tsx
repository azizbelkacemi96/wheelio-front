/**
 * Vehicle detail screen (FLEET-02, D-04/D-09).
 *
 * Composes the two plan 02-01 hooks IN PARALLEL — useVehicleQuery +
 * useActiveContractQuery — with NO waterfall: the contract query is
 * unconditional (an available vehicle just returns [], one cheap request) and
 * a current contract is NEVER inferred from vehicle.status (02-RESEARCH.md
 * anti-pattern). The two queries fail independently: a contract-query error
 * shows an inline banner INSIDE the contract card and must not blank the page,
 * which loaded fine.
 *
 * Fuel reality (02-RESEARCH.md "Fuel level reality"): a vehicle carries a fuel
 * TYPE only (petrol/diesel/…). A fuel LEVEL exists solely on the active
 * contract's departure_fuel_level — so the vehicle card shows the type and the
 * contract card shows the level. Optional vehicle fields are omitempty-ABSENT
 * JSON keys (not null), so every one is presence-guarded before any formatting
 * call (02-RESEARCH.md Pitfall 3). Every label flows through i18n (D-07); raw
 * data values (plate, VIN, notes) render directly via React JSX auto-escaping.
 *
 * The backend deliberately 404s BOTH nonexistent and out-of-scope vehicles, so
 * a 404 renders one generic not-found state — never an access-denied variant
 * that would confirm existence (threat T-02-06). Customer identity is omitted
 * from the contract summary entirely this phase (only customer_id exists —
 * threat T-02-08 / research Open Question 2).
 */
import { isHTTPError } from "ky";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { useLocale } from "@/shared/i18n/useLocale";
import type { Locale } from "@/shared/i18n/useLocale";
import type { VehicleResponse } from "@/types/fleet";
import type { ContractResponse } from "@/types/rental";
import { useAuthStore } from "@/shared/auth/store";
import { canManage, canOperate } from "@/shared/auth/permissions";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { Separator } from "@/shared/ui/separator";
import { PlateBadge } from "@/shared/ui/plate-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { VehicleDocuments } from "@/features/documents/VehicleDocuments";
import { StatusBadge } from "./StatusBadge";
import { useActiveContractQuery, useVehicleQuery } from "./queries";
import { VehicleActionsCard, MileageCard } from "./VehicleManage";

function isNotFound(error: unknown): boolean {
  return isHTTPError(error) && error.response.status === 404;
}

export function VehicleDetail({ vehicleId }: { vehicleId: string }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const scope = useAuthStore((s) => s.scope);

  // Two parallel queries — no conditional/waterfall between them.
  const vehicleQuery = useVehicleQuery(vehicleId);
  const contractQuery = useActiveContractQuery(vehicleId);

  if (vehicleQuery.isPending) {
    return <VehicleDetailSkeleton />;
  }

  if (vehicleQuery.isError) {
    if (isNotFound(vehicleQuery.error)) {
      return <NotFoundState />;
    }
    return (
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <BackLink />
        <div
          className="flex flex-col items-start gap-3 rounded-lg border border-border p-4"
          role="alert"
        >
          <p className="text-sm text-destructive">{t("vehicles.loadError")}</p>
          <Button onClick={() => vehicleQuery.refetch()}>
            {t("vehicles.retry")}
          </Button>
        </div>
      </div>
    );
  }

  const vehicle = vehicleQuery.data;
  const mayManage = scope != null && canManage(scope, vehicle.agency_id);
  const mayOperate = scope != null && canOperate(scope, vehicle.agency_id);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <BackLink />

      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-xl font-semibold text-foreground">
            <PlateBadge plate={vehicle.registration_plate} size="md" />
          </h1>
          <StatusBadge status={vehicle.status} />
        </div>
        <p className="text-sm text-muted-foreground">{vehicleLabel(vehicle)}</p>
      </header>

      <VehicleInfoCard vehicle={vehicle} locale={locale} />
      <CurrentContractCard query={contractQuery} locale={locale} />
      {mayManage && <VehicleActionsCard vehicle={vehicle} />}
      <MileageCard vehicle={vehicle} canWrite={mayOperate} />
      <VehicleDocuments vehicleId={vehicle.id} canWrite={mayOperate} />
    </div>
  );
}

function vehicleLabel(v: VehicleResponse): string {
  const base = `${v.brand} ${v.model}`;
  return v.model_year ? `${base} (${v.model_year})` : base;
}

function BackLink() {
  const { t } = useTranslation();
  return (
    <Link
      to="/vehicules"
      className="text-sm text-primary hover:underline"
    >
      {t("vehicles.detail.backToList")}
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

function VehicleInfoCard({
  vehicle,
  locale,
}: {
  vehicle: VehicleResponse;
  locale: Locale;
}) {
  const { t } = useTranslation();
  const formatMileage = (km: number) => `${km.toLocaleString(locale)} km`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("vehicles.detail.infoTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y divide-border">
          <DetailRow label={t("vehicles.detail.vin")} value={vehicle.vin} />
          <DetailRow
            label={t("vehicles.columns.mileage")}
            value={
              <span className="numeric-cell">
                {formatMileage(vehicle.current_mileage)}
              </span>
            }
          />
          <DetailRow
            label={t("vehicles.columns.fuelType")}
            value={t(`vehicles.fuelType.${vehicle.fuel_type}`)}
          />
          <DetailRow
            label={t("vehicles.detail.transmissionLabel")}
            value={t(`vehicles.transmission.${vehicle.transmission}`)}
          />
          {/* Presence-guarded omitempty fields (absent keys, never null). */}
          {vehicle.model_year !== undefined && (
            <DetailRow
              label={t("vehicles.detail.modelYear")}
              value={vehicle.model_year}
            />
          )}
          {vehicle.color !== undefined && (
            <DetailRow label={t("vehicles.detail.color")} value={vehicle.color} />
          )}
          {vehicle.seats !== undefined && (
            <DetailRow label={t("vehicles.detail.seats")} value={vehicle.seats} />
          )}
          {vehicle.notes !== undefined && (
            <DetailRow label={t("vehicles.detail.notes")} value={vehicle.notes} />
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

function CurrentContractCard({
  query,
  locale,
}: {
  query: ReturnType<typeof useActiveContractQuery>;
  locale: Locale;
}) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("vehicles.detail.currentContract")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ContractCardBody query={query} locale={locale} />
      </CardContent>
    </Card>
  );
}

function ContractCardBody({
  query,
  locale,
}: {
  query: ReturnType<typeof useActiveContractQuery>;
  locale: Locale;
}) {
  const { t } = useTranslation();

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-2" data-testid="contract-loading">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
      </div>
    );
  }

  // A contract-only error stays INSIDE the card — the page is not blanked.
  if (query.isError) {
    return (
      <div className="flex flex-col items-start gap-3" role="alert">
        <p className="text-sm text-destructive">
          {t("vehicles.detail.contractLoadError")}
        </p>
        <Button size="sm" onClick={() => query.refetch()}>
          {t("vehicles.retry")}
        </Button>
      </div>
    );
  }

  const contract = query.data;
  if (contract === null) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("vehicles.detail.noCurrentContract")}
      </p>
    );
  }

  return <ContractSummary contract={contract} locale={locale} />;
}

function ContractSummary({
  contract,
  locale,
}: {
  contract: ContractResponse;
  locale: Locale;
}) {
  const { t } = useTranslation();
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(locale);
  const formatMileage = (km: number) => `${km.toLocaleString(locale)} km`;

  return (
    <dl className="divide-y divide-border">
      <DetailRow
        label={t("vehicles.detail.contractPeriod")}
        value={`${formatDate(contract.starts_at)} → ${formatDate(contract.ends_at)}`}
      />
      <DetailRow
        label={t("vehicles.columns.status")}
        value={t(`contracts.status.${contract.status}`)}
      />
      {/* departure mileage/fuel are recorded at activation, but guard anyway. */}
      {contract.departure_mileage !== undefined && (
        <DetailRow
          label={t("vehicles.detail.departureMileage")}
          value={
            <span className="numeric-cell">
              {formatMileage(contract.departure_mileage)}
            </span>
          }
        />
      )}
      {contract.departure_fuel_level !== undefined && (
        <DetailRow
          label={t("vehicles.detail.departureFuel")}
          value={t(`vehicles.fuelLevel.${contract.departure_fuel_level}`)}
        />
      )}
    </dl>
  );
}

function NotFoundState() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <BackLink />
      <div className="flex min-h-[40svh] flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-xl font-semibold text-foreground">
          {t("vehicles.detail.notFoundHeading")}
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t("vehicles.detail.notFoundBody")}
        </p>
      </div>
    </div>
  );
}

function VehicleDetailSkeleton() {
  return (
    <div
      className="flex flex-col gap-4 p-4 md:p-6"
      data-testid="vehicle-detail-loading"
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
