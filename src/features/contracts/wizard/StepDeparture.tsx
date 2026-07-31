/**
 * Wizard step 4 — departure state. Captures ONLY what the activate endpoint
 * accepts (mileage + fuel level) plus the activate-now toggle. The full
 * photo/zone état des lieux is Phase 5's /inspections endpoint — this step
 * MUST NOT POST any inspection data. The seam card (data-phase=
 * "5-inspection-handoff") marks exactly where Phase 5 slots in.
 */
import { Controller, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Field, FieldError, FieldLabel } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { FUEL_LEVELS, type WizardValues } from "./schema";

export function StepDeparture() {
  const { t } = useTranslation();
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<WizardValues>();

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-foreground">{t("wizard.departure.title")}</h2>

      <Field data-invalid={!!errors.departure_mileage}>
        <FieldLabel htmlFor="departure_mileage">{t("wizard.departure.mileage")}</FieldLabel>
        <Input
          id="departure_mileage"
          type="number"
          min={0}
          inputMode="numeric"
          aria-invalid={!!errors.departure_mileage}
          {...register("departure_mileage")}
        />
        <FieldError
          errors={
            errors.departure_mileage
              ? [{ message: t("wizard.departure.mileage") }]
              : undefined
          }
        />
      </Field>

      <Field data-invalid={!!errors.departure_fuel}>
        <FieldLabel htmlFor="departure_fuel">{t("wizard.departure.fuel")}</FieldLabel>
        <Controller
          control={control}
          name="departure_fuel"
          render={({ field }) => (
            <Select value={field.value ?? ""} onValueChange={field.onChange}>
              <SelectTrigger id="departure_fuel" aria-label={t("wizard.departure.fuel")}>
                <SelectValue />
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
      </Field>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" className="size-4" {...register("activate_now")} />
        {t("wizard.departure.activateNow")}
      </label>

      <div
        data-phase="5-inspection-handoff"
        className="rounded-lg border border-dashed border-border bg-muted/40 p-3 text-sm text-muted-foreground"
      >
        {t("wizard.departure.seamNote")}
      </div>
    </section>
  );
}
