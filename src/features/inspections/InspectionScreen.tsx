/**
 * Inspection capture orchestrator (INSP-01/02/03) — ONE screen shared by
 * departure and return (D-07), reached from the contract detail or the
 * /etats-des-lieux index. Mobile-first (D-08): a field agent works it
 * one-handed at the vehicle.
 *
 * Flow: create (kind + mileage + fuel) → record damage per zone → capture &
 * upload photos per damage (resilient, DamagePhotoCapture) → validate. The
 * Validate action is gated client-side on every damage having ≥1 attached
 * photo (mirrors the backend gate, 05-RESEARCH.md Pitfall 5) and the backend
 * 400 is still handled defensively.
 *
 * Auth gate: canOperate on the VEHICLE's agency_id (D-09) — the contract has
 * no agency_id, so the vehicle is fetched for both the plate and the gate,
 * exactly like ContractDetail.
 *
 * There is NO "list inspections by contract" endpoint, so the created
 * inspection is held in component state for the session; a `return` with no
 * validated departure surfaces the backend 409 as a friendly message.
 */
import { useCallback, useState } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { useAuthStore } from "@/shared/auth/store";
import { canOperate } from "@/shared/auth/permissions";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import { EmptyState } from "@/shared/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Field, FieldError, FieldLabel } from "@/shared/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { useVehicleQuery } from "@/features/fleet/queries";
import { useContractQuery } from "@/features/contracts/queries";
import { FUEL_LEVELS } from "@/features/contracts/wizard/schema";
import type { DamageResponse, InspectionResponse } from "@/types/inspection";
import { INSPECTION_KINDS } from "@/types/inspection";
import { createInspectionSchema, type CreateInspectionValues, type DamageValues } from "./schema";
import {
  needDepartureErrorKey,
  photoRequiredErrorKey,
  useCreateInspection,
  useRecordDamage,
  useValidateInspection,
} from "./mutations";
import { DownloadPdfButton } from "@/features/billing/DownloadPdfButton";
import { inspectionPdfPath } from "@/features/billing/api";
import { ZoneDamageEntry } from "./ZoneDamageEntry";
import { DamagePhotoCapture } from "./DamagePhotoCapture";
import type { UseDamagePhotosOptions } from "./upload/useDamagePhotos";

export function InspectionScreen({
  contractId,
  photoOptions,
}: {
  contractId: string;
  /** injected for tests (fake compress/upload/attach); undefined in prod. */
  photoOptions?: UseDamagePhotosOptions;
}) {
  const { t } = useTranslation();
  const scope = useAuthStore((s) => s.scope);

  const contractQuery = useContractQuery(contractId);
  const contract = contractQuery.data;
  const vehicleQuery = useVehicleQuery(contract?.vehicle_id ?? "", {
    enabled: !!contract,
  });
  const vehicle = vehicleQuery.data;

  const [inspection, setInspection] = useState<InspectionResponse | null>(null);
  const [damages, setDamages] = useState<DamageResponse[]>([]);
  const [photoReady, setPhotoReady] = useState<Record<string, boolean>>({});

  const setDamageReady = useCallback((damageId: string, ready: boolean) => {
    setPhotoReady((prev) =>
      prev[damageId] === ready ? prev : { ...prev, [damageId]: ready },
    );
  }, []);

  if (contractQuery.isPending) return <ScreenSkeleton />;

  if (contractQuery.isError || !contract) {
    return (
      <Screen>
        <BackLink contractId={contractId} />
        <p role="alert" className="text-sm text-destructive">
          {t("inspections.errors.createFailed")}
        </p>
      </Screen>
    );
  }

  // Agency gate — resolved only once the vehicle is loaded. While the vehicle
  // is still loading we optimistically render (the create call is backend-
  // re-enforced regardless), but an explicit deny blocks the screen.
  const denied =
    scope != null && vehicle !== undefined && !canOperate(scope, vehicle.agency_id);
  if (denied) {
    return (
      <Screen>
        <BackLink contractId={contractId} />
        <EmptyState
          titleKey="inspections.capture.notAuthorizedHeading"
          descriptionKey="inspections.capture.notAuthorizedBody"
        />
      </Screen>
    );
  }

  const vehiclePlate = vehicle?.registration_plate ?? "";

  if (inspection?.status === "validated") {
    return (
      <Screen>
        <BackLink contractId={contractId} />
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <CheckCircle2 className="size-10 text-emerald-600 dark:text-emerald-400" aria-hidden={true} />
            <h1 className="text-xl font-semibold text-foreground">
              {t("inspections.capture.validatedHeading")}
            </h1>
            <p className="max-w-sm text-sm text-muted-foreground">
              {t("inspections.capture.validatedBody")}
            </p>
            <DownloadPdfButton
              path={inspectionPdfPath(inspection.id)}
              filename={`edl-${inspection.id}.pdf`}
              label={t("inspections.title") + " (PDF)"}
            />
          </CardContent>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <BackLink contractId={contractId} />
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-semibold text-foreground">
          {t("inspections.title")}
        </h1>
        {vehiclePlate && (
          <p className="text-sm text-muted-foreground">{vehiclePlate}</p>
        )}
      </header>

      {!inspection ? (
        <CreateInspectionCard
          contractId={contractId}
          onCreated={setInspection}
        />
      ) : (
        <CaptureCards
          inspection={inspection}
          vehicleId={contract.vehicle_id}
          damages={damages}
          onDamageAdded={(d) => setDamages((prev) => [...prev, d])}
          photoReady={photoReady}
          onReadyChange={setDamageReady}
          onValidated={setInspection}
          photoOptions={photoOptions}
        />
      )}
    </Screen>
  );
}

// ---- Create step ----

function CreateInspectionCard({
  contractId,
  onCreated,
}: {
  contractId: string;
  onCreated: (i: InspectionResponse) => void;
}) {
  const { t } = useTranslation();
  const createMutation = useCreateInspection();
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateInspectionValues>({
    // z.coerce.number widens the input type to `unknown`; runtime output
    // matches CreateInspectionValues (same cast the rental wizard uses).
    resolver: zodResolver(createInspectionSchema) as unknown as Resolver<CreateInspectionValues>,
    defaultValues: { kind: "departure" },
  });

  const submit = handleSubmit((values) => {
    createMutation.mutate(
      { contractId, body: { kind: values.kind, mileage: values.mileage, fuel: values.fuel } },
      { onSuccess: onCreated },
    );
  });

  const errorKey =
    needDepartureErrorKey(createMutation.error) ??
    (createMutation.isError ? "inspections.errors.createFailed" : null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("inspections.capture.chooseKind")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Field data-invalid={!!errors.kind}>
            <FieldLabel htmlFor="inspection-kind">{t("inspections.capture.chooseKind")}</FieldLabel>
            <Controller
              control={control}
              name="kind"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger id="inspection-kind" className="w-full" aria-label={t("inspections.capture.chooseKind")}>
                    <SelectValue placeholder={t("inspections.capture.selectPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {INSPECTION_KINDS.map((kind) => (
                      <SelectItem key={kind} value={kind}>
                        {t(`inspections.kind.${kind}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field data-invalid={!!errors.mileage}>
            <FieldLabel htmlFor="inspection-mileage">{t("inspections.capture.mileage")}</FieldLabel>
            <Input
              id="inspection-mileage"
              type="number"
              min={0}
              inputMode="numeric"
              aria-invalid={!!errors.mileage}
              {...register("mileage")}
            />
            <FieldError
              errors={errors.mileage ? [{ message: t("inspections.errors.mileageInvalid") }] : undefined}
            />
          </Field>

          <Field data-invalid={!!errors.fuel}>
            <FieldLabel htmlFor="inspection-fuel">{t("inspections.capture.fuel")}</FieldLabel>
            <Controller
              control={control}
              name="fuel"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger id="inspection-fuel" className="w-full" aria-label={t("inspections.capture.fuel")}>
                    <SelectValue placeholder={t("inspections.capture.selectPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {FUEL_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {t(`vehicles.fuelLevel.${level}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError
              errors={errors.fuel ? [{ message: t("inspections.errors.fuelRequired") }] : undefined}
            />
          </Field>

          {errorKey && (
            <p role="alert" className="text-sm text-destructive">
              {t(errorKey)}
            </p>
          )}

          <div>
            <Button type="submit" disabled={createMutation.isPending}>
              {t("inspections.capture.start")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ---- Capture step (damages + photos + validate) ----

function CaptureCards({
  inspection,
  vehicleId,
  damages,
  onDamageAdded,
  photoReady,
  onReadyChange,
  onValidated,
  photoOptions,
}: {
  inspection: InspectionResponse;
  vehicleId: string;
  damages: DamageResponse[];
  onDamageAdded: (d: DamageResponse) => void;
  photoReady: Record<string, boolean>;
  onReadyChange: (damageId: string, ready: boolean) => void;
  onValidated: (i: InspectionResponse) => void;
  photoOptions?: UseDamagePhotosOptions;
}) {
  const { t } = useTranslation();
  const recordMutation = useRecordDamage();
  const validateMutation = useValidateInspection(inspection.id);

  const addDamage = (values: DamageValues) => {
    recordMutation.mutate(
      { inspectionId: inspection.id, body: values },
      { onSuccess: onDamageAdded },
    );
  };

  // Every recorded damage must have ≥1 attached photo (vacuously true when
  // there are no damages — a clean inspection is validatable).
  const canValidate = damages.every((d) => photoReady[d.id]);

  const validateErrorKey =
    photoRequiredErrorKey(validateMutation.error) ??
    (validateMutation.isError ? "inspections.errors.validateFailed" : null);

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <ZoneDamageEntry
            onAdd={addDamage}
            isSubmitting={recordMutation.isPending}
            errorMessage={
              recordMutation.isError ? t("inspections.errors.recordDamageFailed") : undefined
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("inspections.capture.damagesTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {damages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("inspections.capture.noDamages")}
            </p>
          ) : (
            damages.map((damage) => (
              <RecordedDamageItem
                key={damage.id}
                damage={damage}
                vehicleId={vehicleId}
                onReadyChange={onReadyChange}
                photoOptions={photoOptions}
              />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-2 pt-6">
          <p className="text-sm text-muted-foreground">
            {t("inspections.capture.validateHint")}
          </p>
          {validateErrorKey && (
            <p role="alert" className="text-sm text-destructive">
              {t(validateErrorKey)}
            </p>
          )}
          <div>
            <Button
              type="button"
              disabled={!canValidate || validateMutation.isPending}
              onClick={() => validateMutation.mutate(undefined, { onSuccess: onValidated })}
            >
              {t("inspections.capture.validate")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function RecordedDamageItem({
  damage,
  vehicleId,
  onReadyChange,
  photoOptions,
}: {
  damage: DamageResponse;
  vehicleId: string;
  onReadyChange: (damageId: string, ready: boolean) => void;
  photoOptions?: UseDamagePhotosOptions;
}) {
  const { t } = useTranslation();
  const handleReady = useCallback(
    (ready: boolean) => onReadyChange(damage.id, ready),
    [damage.id, onReadyChange],
  );

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-sm font-medium text-foreground">
          {t(`inspections.zone.${damage.zone}`)}
        </span>
        <span className="text-sm text-muted-foreground">
          {t(`inspections.damageType.${damage.damage_type}`)} ·{" "}
          {t(`inspections.severity.${damage.severity}`)}
        </span>
      </div>
      {damage.description && (
        <p className="text-sm text-muted-foreground">{damage.description}</p>
      )}
      <DamagePhotoCapture
        damageId={damage.id}
        vehicleId={vehicleId}
        onReadyChange={handleReady}
        photoOptions={photoOptions}
      />
    </div>
  );
}

// ---- Layout helpers ----

function Screen({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 md:p-6">{children}</div>;
}

function BackLink({ contractId }: { contractId: string }) {
  const { t } = useTranslation();
  return (
    <Link
      to="/contrats/$contractId"
      params={{ contractId }}
      className="text-sm text-primary hover:underline"
    >
      {t("inspections.capture.backToContract")}
    </Link>
  );
}

function ScreenSkeleton() {
  return (
    <Screen>
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-48 w-full" />
    </Screen>
  );
}
