/**
 * Vehicle management actions (Phase 8) for the detail screen:
 * - VehicleActionsCard: edit link, status change, archive (manager+ / org admin)
 * - MileageCard: log a new odometer reading + the mileage history (agent+)
 *
 * Status change / archive can 409 (illegal transition, e.g. archiving a rented
 * vehicle) — surfaced via statusErrorKey, never the raw problem detail.
 */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "@tanstack/react-router";
import { useLocale } from "@/shared/i18n/useLocale";
import type { VehicleResponse, VehicleStatus } from "@/types/fleet";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Field, FieldLabel } from "@/shared/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { useMileageQuery } from "./queries";
import {
  statusErrorKey,
  useArchiveVehicle,
  useChangeVehicleStatus,
  useLogMileage,
} from "./mutations";

const STATUSES: readonly VehicleStatus[] = ["available", "rented", "maintenance", "retired"];

export function VehicleActionsCard({ vehicle }: { vehicle: VehicleResponse }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const statusMutation = useChangeVehicleStatus(vehicle.id);
  const archiveMutation = useArchiveVehicle(vehicle.id);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const errorKey = statusErrorKey(statusMutation.error ?? archiveMutation.error);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("fleet.manage.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field className="w-full sm:w-56">
            <FieldLabel htmlFor="v-status">{t("fleet.manage.status")}</FieldLabel>
            <Select
              value={vehicle.status}
              onValueChange={(value) => statusMutation.mutate({ status: value as VehicleStatus })}
            >
              <SelectTrigger id="v-status" className="w-full" aria-label={t("fleet.manage.status")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`vehicles.status.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Button asChild variant="outline">
            <Link to="/vehicules/$vehicleId/modifier" params={{ vehicleId: vehicle.id }}>
              {t("fleet.manage.edit")}
            </Link>
          </Button>

          {!confirmArchive ? (
            <Button variant="outline" onClick={() => setConfirmArchive(true)}>
              {t("fleet.manage.archive")}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t("fleet.manage.archiveConfirm")}</span>
              <Button
                variant="destructive"
                size="sm"
                disabled={archiveMutation.isPending}
                onClick={() =>
                  archiveMutation.mutate(undefined, {
                    onSuccess: () => void navigate({ to: "/vehicules" }),
                  })
                }
              >
                {t("fleet.manage.archiveYes")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmArchive(false)}>
                {t("fleet.manage.cancel")}
              </Button>
            </div>
          )}
        </div>

        {errorKey && (
          <p role="alert" className="text-sm text-destructive">
            {t(errorKey)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function MileageCard({ vehicle, canWrite }: { vehicle: VehicleResponse; canWrite: boolean }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const historyQuery = useMileageQuery(vehicle.id);
  const mutation = useLogMileage(vehicle.id);
  const { register, handleSubmit, reset } = useForm<{ mileage: number }>();

  const submit = handleSubmit((values) => {
    mutation.mutate({ mileage: Number(values.mileage) }, { onSuccess: () => reset({ mileage: undefined }) });
  });

  const history = historyQuery.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("fleet.mileage.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {t("fleet.mileage.current")}:{" "}
          <span className="numeric-cell font-medium text-foreground">
            {vehicle.current_mileage.toLocaleString(locale)} km
          </span>
        </p>

        {canWrite && (
          <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
            <Field className="w-full sm:w-48">
              <FieldLabel htmlFor="mileage-input">{t("fleet.mileage.new")}</FieldLabel>
              <Input
                id="mileage-input"
                type="number"
                min={0}
                inputMode="numeric"
                {...register("mileage")}
              />
            </Field>
            <Button type="submit" disabled={mutation.isPending}>
              {t("fleet.mileage.log")}
            </Button>
          </form>
        )}
        {mutation.isError && (
          <p role="alert" className="text-sm text-destructive">
            {t("fleet.mileage.logError")}
          </p>
        )}

        {historyQuery.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : history.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border text-sm">
            {history.slice(0, 8).map((log) => (
              <li key={log.id} className="flex items-center justify-between gap-2 py-1.5">
                <span className="numeric-cell font-medium text-foreground">
                  {log.mileage.toLocaleString(locale)} km
                </span>
                <span className="text-muted-foreground">
                  {t(`fleet.mileage.source.${log.source}`, { defaultValue: log.source })} ·{" "}
                  {new Date(log.recorded_at).toLocaleDateString(locale)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
