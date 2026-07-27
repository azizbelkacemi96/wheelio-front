/**
 * Vehicle list screen (FLEET-01, D-01/D-03/D-09).
 *
 * Data comes exclusively from useVehiclesQuery (plan 02-01) — status is a
 * SERVER-side filter (?status=, keyed in the cache), while the text search is
 * a CLIENT-side useMemo over the already-fetched array (the list is
 * unpaginated — 02-RESEARCH.md Pitfall 6, no slicing / no debounce).
 *
 * Responsive per D-01: a dense <table> on md+ and a stacked <Card> list below
 * md. Both are always in the DOM (CSS controls visibility) because jsdom can't
 * evaluate media queries. Every visible string flows through i18n (D-07); the
 * only bare literals are raw data (plate, "km" unit baked into the mileage).
 *
 * Agency names have no field on vehicleResponse — they are resolved from the
 * auth store's owner-only agencies list; when that list is empty (non-admins),
 * the agency column/field is omitted entirely (02-RESEARCH.md D-03 tension).
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { useAuthStore } from "@/shared/auth/store";
import { useLocale } from "@/shared/i18n/useLocale";
import type { VehicleResponse, VehicleStatus } from "@/types/fleet";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import { EmptyState } from "@/shared/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
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
import { StatusBadge } from "./StatusBadge";
import { useVehiclesQuery } from "./queries";

/** The four backend statuses, in display order (exhaustive over the union). */
const VEHICLE_STATUSES: readonly VehicleStatus[] = [
  "available",
  "rented",
  "maintenance",
  "retired",
];

/** Sentinel for the "all statuses" option — Radix Select forbids an empty
 * string value, so `null` status is represented as this literal in the UI. */
const ALL_STATUSES = "all";

function vehicleLabel(v: VehicleResponse): string {
  const base = `${v.brand} ${v.model}`;
  return v.model_year ? `${base} (${v.model_year})` : base;
}

export function VehicleList() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const agencies = useAuthStore((s) => s.agencies);

  const [status, setStatus] = useState<VehicleStatus | null>(null);
  const [search, setSearch] = useState("");

  const query = useVehiclesQuery(status);
  const vehicles = query.data ?? [];

  const showAgency = agencies.length > 0;
  const agencyName = (agencyId: string) =>
    agencies.find((a) => a.id === agencyId)?.name ?? "—";
  const formatMileage = (km: number) => `${km.toLocaleString(locale)} km`;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return vehicles;
    return vehicles.filter(
      (v) =>
        v.registration_plate.toLowerCase().includes(term) ||
        v.brand.toLowerCase().includes(term) ||
        v.model.toLowerCase().includes(term),
    );
  }, [vehicles, search]);

  const isFilterActive = status !== null || search.trim() !== "";
  // Controls stay mounted whenever a filter is active, even if it currently
  // matches nothing — otherwise selecting a zero-result status would unmount
  // the very Select holding that filter, stranding the user with no way to
  // clear it (CR-01). Only a genuinely empty fleet (no filter) hides them.
  const showControls = query.isSuccess && (vehicles.length > 0 || isFilterActive);
  const showCount = query.isSuccess && filtered.length > 0;

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-semibold text-foreground">
          {t("vehicles.title")}
        </h1>
        {showCount && (
          <p className="text-sm text-muted-foreground">
            {t("vehicleCount", { count: filtered.length })}
          </p>
        )}
      </header>

      {showControls && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            type="search"
            aria-label={t("vehicles.searchPlaceholder")}
            placeholder={t("vehicles.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs"
          />
          <Select
            value={status ?? ALL_STATUSES}
            onValueChange={(value) =>
              setStatus(value === ALL_STATUSES ? null : (value as VehicleStatus))
            }
          >
            <SelectTrigger
              aria-label={t("vehicles.statusFilterLabel")}
              className="sm:w-56"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUSES}>
                {t("vehicles.statusFilterAll")}
              </SelectItem>
              {VEHICLE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`vehicles.status.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <VehicleListBody
        query={query}
        vehicles={vehicles}
        filtered={filtered}
        isFilterActive={isFilterActive}
        showAgency={showAgency}
        agencyName={agencyName}
        formatMileage={formatMileage}
      />
    </div>
  );
}

interface BodyProps {
  query: ReturnType<typeof useVehiclesQuery>;
  vehicles: VehicleResponse[];
  filtered: VehicleResponse[];
  isFilterActive: boolean;
  showAgency: boolean;
  agencyName: (agencyId: string) => string;
  formatMileage: (km: number) => string;
}

function VehicleListBody({
  query,
  vehicles,
  filtered,
  isFilterActive,
  showAgency,
  agencyName,
  formatMileage,
}: BodyProps) {
  const { t } = useTranslation();

  if (query.isPending) return <VehicleListSkeleton showAgency={showAgency} />;

  if (query.isError) {
    return (
      <div
        className="flex flex-col items-start gap-3 rounded-lg border border-border p-4"
        role="alert"
      >
        <p className="text-sm text-destructive">{t("vehicles.loadError")}</p>
        <Button onClick={() => query.refetch()}>{t("vehicles.retry")}</Button>
      </div>
    );
  }

  // True-empty fleet ONLY when nothing is filtered. A zero-row result while a
  // status/search filter is active is "no matches", not "no vehicles" (CR-01).
  if (vehicles.length === 0 && !isFilterActive) {
    return (
      <EmptyState
        titleKey="vehicles.empty.heading"
        descriptionKey="vehicles.empty.body"
      />
    );
  }

  if (filtered.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("vehicles.noResults")}
      </p>
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <VehicleTable
          vehicles={filtered}
          showAgency={showAgency}
          agencyName={agencyName}
          formatMileage={formatMileage}
        />
      </div>
      <div className="flex flex-col gap-3 md:hidden" data-testid="vehicle-card-stack">
        {filtered.map((v) => (
          <VehicleCard
            key={v.id}
            vehicle={v}
            showAgency={showAgency}
            agencyName={agencyName}
            formatMileage={formatMileage}
          />
        ))}
      </div>
    </>
  );
}

interface RowsProps {
  vehicles: VehicleResponse[];
  showAgency: boolean;
  agencyName: (agencyId: string) => string;
  formatMileage: (km: number) => string;
}

function VehicleTable({
  vehicles,
  showAgency,
  agencyName,
  formatMileage,
}: RowsProps) {
  const { t } = useTranslation();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="px-3 py-2">{t("vehicles.columns.plate")}</TableHead>
          <TableHead className="px-3 py-2">{t("vehicles.columns.vehicle")}</TableHead>
          <TableHead className="px-3 py-2">{t("vehicles.columns.status")}</TableHead>
          <TableHead className="px-3 py-2">{t("vehicles.columns.mileage")}</TableHead>
          <TableHead className="px-3 py-2">{t("vehicles.columns.fuelType")}</TableHead>
          {showAgency && (
            <TableHead className="px-3 py-2">{t("vehicles.columns.agency")}</TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {vehicles.map((v) => (
          <TableRow key={v.id}>
            <TableCell className="px-3 py-2 font-medium">
              <Link
                to="/vehicules/$vehicleId"
                params={{ vehicleId: v.id }}
                className="text-primary hover:underline"
              >
                {v.registration_plate}
              </Link>
            </TableCell>
            <TableCell className="px-3 py-2">{vehicleLabel(v)}</TableCell>
            <TableCell className="px-3 py-2">
              <StatusBadge status={v.status} />
            </TableCell>
            <TableCell className="numeric-cell px-3 py-2">
              {formatMileage(v.current_mileage)}
            </TableCell>
            <TableCell className="px-3 py-2">
              {t(`vehicles.fuelType.${v.fuel_type}`)}
            </TableCell>
            {showAgency && (
              <TableCell className="px-3 py-2">{agencyName(v.agency_id)}</TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

interface CardProps {
  vehicle: VehicleResponse;
  showAgency: boolean;
  agencyName: (agencyId: string) => string;
  formatMileage: (km: number) => string;
}

function VehicleCard({ vehicle, showAgency, agencyName, formatMileage }: CardProps) {
  const { t } = useTranslation();
  return (
    <Card size="sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>
          <Link
            to="/vehicules/$vehicleId"
            params={{ vehicleId: vehicle.id }}
            className="text-primary hover:underline"
          >
            {vehicle.registration_plate}
          </Link>
        </CardTitle>
        <StatusBadge status={vehicle.status} />
      </CardHeader>
      <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
        <span className="text-foreground">{vehicleLabel(vehicle)}</span>
        <span className="numeric-cell">{formatMileage(vehicle.current_mileage)}</span>
        <span>{t(`vehicles.fuelType.${vehicle.fuel_type}`)}</span>
        {showAgency && <span>{agencyName(vehicle.agency_id)}</span>}
      </CardContent>
    </Card>
  );
}

function VehicleListSkeleton({ showAgency }: { showAgency: boolean }) {
  const columns = showAgency ? 6 : 5;
  return (
    <div className="flex flex-col gap-2" data-testid="vehicle-list-loading">
      {Array.from({ length: 6 }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-3">
          {Array.from({ length: columns }).map((__, colIdx) => (
            <Skeleton key={colIdx} className="h-6 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
