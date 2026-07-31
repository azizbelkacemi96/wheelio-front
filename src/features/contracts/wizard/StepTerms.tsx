/**
 * Wizard step 3 — contract terms: start/end datetime (native datetime-local,
 * converted to RFC3339 Algiers at finish) plus an OPTIONAL deposit (amount in
 * DZD + method). The ends>starts rule is enforced by the schema refine and
 * surfaced here on the end field.
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
import { DEPOSIT_METHODS, type WizardValues } from "./schema";

export function StepTerms() {
  const { t } = useTranslation();
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<WizardValues>();

  const endError = errors.ends_at_local?.message
    ? [{ message: t(errors.ends_at_local.message) }]
    : undefined;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-foreground">{t("wizard.terms.title")}</h2>

      <Field data-invalid={!!errors.starts_at_local}>
        <FieldLabel htmlFor="starts_at_local">{t("wizard.terms.startsAt")}</FieldLabel>
        <Input
          id="starts_at_local"
          type="datetime-local"
          aria-invalid={!!errors.starts_at_local}
          {...register("starts_at_local")}
        />
      </Field>

      <Field data-invalid={!!errors.ends_at_local}>
        <FieldLabel htmlFor="ends_at_local">{t("wizard.terms.endsAt")}</FieldLabel>
        <Input
          id="ends_at_local"
          type="datetime-local"
          aria-invalid={!!errors.ends_at_local}
          {...register("ends_at_local")}
        />
        <FieldError errors={endError} />
      </Field>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-3">
        <legend className="px-1 text-sm text-muted-foreground">
          {t("wizard.terms.depositOptional")}
        </legend>
        <Field>
          <FieldLabel htmlFor="deposit_amount">{t("contracts.deposit.amount")}</FieldLabel>
          <Input
            id="deposit_amount"
            type="number"
            min={0}
            inputMode="numeric"
            {...register("deposit_amount")}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="deposit_method">{t("contracts.deposit.method")}</FieldLabel>
          <Controller
            control={control}
            name="deposit_method"
            render={({ field }) => (
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <SelectTrigger id="deposit_method" aria-label={t("contracts.deposit.method")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPOSIT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {t(`contracts.deposit.${m}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </fieldset>
    </section>
  );
}
