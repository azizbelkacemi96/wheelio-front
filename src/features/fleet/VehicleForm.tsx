/**
 * Vehicle create/edit form (Phase 8). One component, two modes:
 * - create: full form incl. agency (picked from the user's visible agencies),
 *   VIN and initial mileage; POSTs a new vehicle.
 * - edit: the mutable subset (no agency/VIN/mileage — those are immutable or
 *   logged separately); PATCHes the vehicle.
 *
 * Purchase price is entered in DZD and converted to cents at submit. On success
 * it navigates to the vehicle detail. Gating (who may create/edit) is done by
 * the caller/route; the backend re-enforces.
 */
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import type { AgencyResponse } from "@/types/identity";
import type {
  CreateVehicleBody,
  UpdateVehicleBody,
  VehicleResponse,
} from "@/types/fleet";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Field, FieldError, FieldLabel } from "@/shared/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { useVehicleClassesQuery } from "@/features/pricing/queries";
import {
  FUEL_TYPES,
  TRANSMISSIONS,
  createVehicleSchema,
  editVehicleSchema,
  type CreateVehicleValues,
  type EditVehicleValues,
} from "./schema";
import { useCreateVehicle, useUpdateVehicle } from "./mutations";

const NO_CLASS = "__none__";

type Props = { mode: "create" } | { mode: "edit"; vehicle: VehicleResponse };

const toCents = (dzd?: number) => (dzd === undefined ? undefined : Math.round(dzd * 100));

export function VehicleForm(props: Props) {
  return props.mode === "create" ? (
    <CreateVehicleForm />
  ) : (
    <EditVehicleForm vehicle={props.vehicle} />
  );
}

// ---- Create ----

function CreateVehicleForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const mutation = useCreateVehicle();

  const agenciesQuery = useQuery({
    queryKey: ["agencies"],
    queryFn: () => api.get("agencies").json<AgencyResponse[]>(),
  });
  const agencies = agenciesQuery.data ?? [];

  const form = useForm<CreateVehicleValues>({
    resolver: zodResolver(createVehicleSchema) as unknown as Resolver<CreateVehicleValues>,
    defaultValues: { fuel_type: "petrol", transmission: "manual" },
  });

  const submit = form.handleSubmit((v) => {
    const body: CreateVehicleBody = {
      agency_id: v.agency_id,
      vin: v.vin,
      registration_plate: v.registration_plate,
      brand: v.brand,
      model: v.model,
      model_year: v.model_year,
      color: v.color,
      fuel_type: v.fuel_type,
      transmission: v.transmission,
      seats: v.seats,
      initial_mileage: v.initial_mileage,
      purchase_date: v.purchase_date,
      purchase_price_cents: toCents(v.purchase_price_dzd),
      notes: v.notes,
      class_id: v.class_id,
    };
    mutation.mutate(body, {
      onSuccess: (created) =>
        void navigate({ to: "/vehicules/$vehicleId", params: { vehicleId: created.id } }),
    });
  });

  return (
    <FormShell titleKey="fleet.create.title" backLabel={t("fleet.backToList")}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field data-invalid={!!form.formState.errors.agency_id}>
          <FieldLabel htmlFor="v-agency">{t("fleet.form.agency")}</FieldLabel>
          <Controller
            control={form.control}
            name="agency_id"
            render={({ field }) => (
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <SelectTrigger id="v-agency" className="w-full" aria-label={t("fleet.form.agency")}>
                  <SelectValue placeholder={t("fleet.form.selectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {agencies.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError
            errors={
              form.formState.errors.agency_id
                ? [{ message: t("fleet.errors.agencyRequired") }]
                : undefined
            }
          />
        </Field>

        <TextField form={form} name="vin" label={t("fleet.form.vin")} errorKey="fleet.errors.vinLength" />
        <SharedVehicleFields form={form} />

        <NumberField form={form} name="initial_mileage" label={t("fleet.form.initialMileage")} />

        {mutation.isError && (
          <p role="alert" className="text-sm text-destructive">
            {t("fleet.errors.createFailed")}
          </p>
        )}
        <div>
          <Button type="submit" disabled={mutation.isPending}>
            {t("fleet.create.submit")}
          </Button>
        </div>
      </form>
    </FormShell>
  );
}

// ---- Edit ----

function EditVehicleForm({ vehicle }: { vehicle: VehicleResponse }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const mutation = useUpdateVehicle(vehicle.id);

  const form = useForm<EditVehicleValues>({
    resolver: zodResolver(editVehicleSchema) as unknown as Resolver<EditVehicleValues>,
    defaultValues: {
      registration_plate: vehicle.registration_plate,
      brand: vehicle.brand,
      model: vehicle.model,
      model_year: vehicle.model_year,
      color: vehicle.color ?? "",
      fuel_type: vehicle.fuel_type,
      transmission: vehicle.transmission,
      seats: vehicle.seats,
      purchase_date: vehicle.purchase_date ?? "",
      purchase_price_dzd:
        vehicle.purchase_price_cents !== undefined
          ? vehicle.purchase_price_cents / 100
          : undefined,
      notes: vehicle.notes ?? "",
      class_id: vehicle.class_id ?? undefined,
    },
  });

  const submit = form.handleSubmit((v) => {
    const body: UpdateVehicleBody = {
      registration_plate: v.registration_plate,
      brand: v.brand,
      model: v.model,
      model_year: v.model_year,
      color: v.color,
      fuel_type: v.fuel_type,
      transmission: v.transmission,
      seats: v.seats,
      purchase_date: v.purchase_date,
      purchase_price_cents: toCents(v.purchase_price_dzd),
      notes: v.notes,
      class_id: v.class_id ?? null,
    };
    mutation.mutate(body, {
      onSuccess: () =>
        void navigate({ to: "/vehicules/$vehicleId", params: { vehicleId: vehicle.id } }),
    });
  });

  return (
    <FormShell titleKey="fleet.edit.title" backLabel={t("fleet.backToDetail")}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <SharedVehicleFields form={form} />
        {mutation.isError && (
          <p role="alert" className="text-sm text-destructive">
            {t("fleet.errors.updateFailed")}
          </p>
        )}
        <div>
          <Button type="submit" disabled={mutation.isPending}>
            {t("fleet.edit.submit")}
          </Button>
        </div>
      </form>
    </FormShell>
  );
}

// ---- Shared fields (present in both modes) ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SharedVehicleFields({ form }: { form: any }) {
  const { t } = useTranslation();
  const classesQuery = useVehicleClassesQuery();
  const classes = (classesQuery.data ?? []).filter((c) => c.active);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField form={form} name="registration_plate" label={t("fleet.form.plate")} errorKey="fleet.errors.plateRequired" />
        <TextField form={form} name="brand" label={t("fleet.form.brand")} errorKey="fleet.errors.brandRequired" />
        <TextField form={form} name="model" label={t("fleet.form.model")} errorKey="fleet.errors.modelRequired" />
        <NumberField form={form} name="model_year" label={t("fleet.form.modelYear")} />
        <TextField form={form} name="color" label={t("fleet.form.color")} />
        <NumberField form={form} name="seats" label={t("fleet.form.seats")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="v-fuel">{t("fleet.form.fuelType")}</FieldLabel>
          <Controller
            control={form.control}
            name="fuel_type"
            render={({ field }) => (
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <SelectTrigger id="v-fuel" className="w-full" aria-label={t("fleet.form.fuelType")}>
                  <SelectValue placeholder={t("fleet.form.selectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {FUEL_TYPES.map((f) => (
                    <SelectItem key={f} value={f}>
                      {t(`vehicles.fuelType.${f}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="v-transmission">{t("fleet.form.transmission")}</FieldLabel>
          <Controller
            control={form.control}
            name="transmission"
            render={({ field }) => (
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <SelectTrigger id="v-transmission" className="w-full" aria-label={t("fleet.form.transmission")}>
                  <SelectValue placeholder={t("fleet.form.selectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {TRANSMISSIONS.map((tr) => (
                    <SelectItem key={tr} value={tr}>
                      {t(`vehicles.transmission.${tr}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </div>

      {classes.length > 0 && (
        <Field>
          <FieldLabel htmlFor="v-class">{t("fleet.form.class")}</FieldLabel>
          <Controller
            control={form.control}
            name="class_id"
            render={({ field }) => (
              <Select
                value={field.value ?? NO_CLASS}
                onValueChange={(val) => field.onChange(val === NO_CLASS ? undefined : val)}
              >
                <SelectTrigger id="v-class" className="w-full" aria-label={t("fleet.form.class")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CLASS}>{t("fleet.form.noClass")}</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <DateField form={form} name="purchase_date" label={t("fleet.form.purchaseDate")} />
        <NumberField form={form} name="purchase_price_dzd" label={t("fleet.form.purchasePrice")} />
      </div>
      <TextField form={form} name="notes" label={t("fleet.form.notes")} />
    </>
  );
}

// ---- Field primitives ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TextField({ form, name, label, errorKey }: { form: any; name: string; label: string; errorKey?: string }) {
  const { t } = useTranslation();
  const err = form.formState.errors[name];
  return (
    <Field data-invalid={!!err}>
      <FieldLabel htmlFor={`v-${name}`}>{label}</FieldLabel>
      <Input id={`v-${name}`} aria-invalid={!!err} {...form.register(name)} />
      {errorKey && <FieldError errors={err ? [{ message: t(errorKey) }] : undefined} />}
    </Field>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function NumberField({ form, name, label }: { form: any; name: string; label: string }) {
  return (
    <Field>
      <FieldLabel htmlFor={`v-${name}`}>{label}</FieldLabel>
      <Input id={`v-${name}`} type="number" inputMode="numeric" {...form.register(name)} />
    </Field>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DateField({ form, name, label }: { form: any; name: string; label: string }) {
  return (
    <Field>
      <FieldLabel htmlFor={`v-${name}`}>{label}</FieldLabel>
      <Input id={`v-${name}`} type="date" {...form.register(name)} />
    </Field>
  );
}

function FormShell({
  titleKey,
  backLabel,
  children,
}: {
  titleKey: string;
  backLabel: string;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 md:p-6">
      <button
        type="button"
        onClick={() => void navigate({ to: "/vehicules" })}
        className="self-start text-sm text-primary hover:underline"
      >
        {backLabel}
      </button>
      <Card>
        <CardHeader>
          <CardTitle>{t(titleKey)}</CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
