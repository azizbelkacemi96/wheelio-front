/**
 * Add-a-damage form (INSP-01): zone → type → severity → optional
 * position/description. zone/type/severity option lists AND the zod `oneof`
 * are both driven from the src/types/inspection.ts enum arrays (never a
 * client-invented list, D-02/D-03). On a valid submit it calls `onAdd` and
 * resets — the parent InspectionScreen owns the recordDamage mutation.
 */
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Field, FieldError, FieldLabel } from "@/shared/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { DAMAGE_TYPES, SEVERITIES, ZONES } from "@/types/inspection";
import { damageSchema, type DamageValues } from "./schema";

export function ZoneDamageEntry({
  onAdd,
  isSubmitting,
  errorMessage,
}: {
  onAdd: (values: DamageValues) => void;
  isSubmitting: boolean;
  errorMessage?: string;
}) {
  const { t } = useTranslation();
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DamageValues>({
    // zod preprocess/optional widen the input type to `unknown`; the runtime
    // output matches DamageValues (same cast the rental wizard uses).
    resolver: zodResolver(damageSchema) as unknown as Resolver<DamageValues>,
  });

  const submit = handleSubmit((values) => {
    onAdd(values);
    reset();
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-foreground">
        {t("inspections.capture.addDamageTitle")}
      </h3>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field data-invalid={!!errors.zone}>
          <FieldLabel htmlFor="damage-zone">{t("inspections.capture.zone")}</FieldLabel>
          <Controller
            control={control}
            name="zone"
            render={({ field }) => (
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <SelectTrigger
                  id="damage-zone"
                  className="w-full"
                  aria-label={t("inspections.capture.zone")}
                >
                  <SelectValue placeholder={t("inspections.capture.selectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {ZONES.map((zone) => (
                    <SelectItem key={zone} value={zone}>
                      {t(`inspections.zone.${zone}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError
            errors={errors.zone ? [{ message: t("inspections.errors.zoneRequired") }] : undefined}
          />
        </Field>

        <Field data-invalid={!!errors.damage_type}>
          <FieldLabel htmlFor="damage-type">{t("inspections.capture.damageType")}</FieldLabel>
          <Controller
            control={control}
            name="damage_type"
            render={({ field }) => (
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <SelectTrigger
                  id="damage-type"
                  className="w-full"
                  aria-label={t("inspections.capture.damageType")}
                >
                  <SelectValue placeholder={t("inspections.capture.selectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {DAMAGE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`inspections.damageType.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError
            errors={errors.damage_type ? [{ message: t("inspections.errors.typeRequired") }] : undefined}
          />
        </Field>

        <Field data-invalid={!!errors.severity}>
          <FieldLabel htmlFor="damage-severity">{t("inspections.capture.severity")}</FieldLabel>
          <Controller
            control={control}
            name="severity"
            render={({ field }) => (
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <SelectTrigger
                  id="damage-severity"
                  className="w-full"
                  aria-label={t("inspections.capture.severity")}
                >
                  <SelectValue placeholder={t("inspections.capture.selectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map((severity) => (
                    <SelectItem key={severity} value={severity}>
                      {t(`inspections.severity.${severity}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError
            errors={errors.severity ? [{ message: t("inspections.errors.severityRequired") }] : undefined}
          />
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="damage-position">{t("inspections.capture.position")}</FieldLabel>
        <Input id="damage-position" {...register("position")} />
      </Field>

      <Field>
        <FieldLabel htmlFor="damage-description">{t("inspections.capture.description")}</FieldLabel>
        <Input id="damage-description" {...register("description")} />
      </Field>

      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {t("inspections.capture.recordDamage")}
        </Button>
      </div>
    </form>
  );
}
