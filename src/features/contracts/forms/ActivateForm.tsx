/**
 * Activate (start-of-rental) form (RENT-02).
 *
 * Records the departure state — mileage + fuel level — and moves the contract
 * reserved -> active via `useActivate` (04-01). Mirrors CustomerCreateForm's
 * react-hook-form + zodResolver + Field/FieldError idiom; validation messages
 * are i18n KEYS resolved through `translatedError` at render (never bare
 * strings reach the DOM).
 *
 * A 409 here is a STALE-UI illegal transition (someone already advanced the
 * contract) — it maps to the DISTINCT `transitionErrorKey("activate", …)`
 * message and forces a detail refetch (invalidate ['contracts','detail',id])
 * so the parent re-gates its buttons to the true current status (Pitfall 2 /
 * T-04-05). Any non-409 failure shows the generic `activateFailed` key.
 */
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { ContractResponse } from "@/types/rental";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/shared/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { useActivate, transitionErrorKey } from "../mutations";
import { activateSchema, toActivateBody, type ActivateFormValues } from "../schemas";
import { FUEL_LEVELS, translatedError } from "./formHelpers";

// zod's `coerce` widens the resolver INPUT type to `unknown` (numeric fields
// are typed via strings entered in the DOM). Cast to the parsed output shape
// so RHF's register/Path typing resolves — the runtime resolver still coerces
// + validates (the CustomerCreateForm idiom).
const resolver = zodResolver(activateSchema) as unknown as Resolver<ActivateFormValues>;

export function ActivateForm({
  contract,
  onDone,
}: {
  contract: ContractResponse;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const activate = useActivate(contract.id);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ActivateFormValues>({
    resolver,
    defaultValues: { mileage: 0, fuel: "full" },
  });

  async function onSubmit(values: ActivateFormValues) {
    setSubmitError(null);
    try {
      await activate.mutateAsync(toActivateBody(values));
      onDone();
    } catch (error) {
      const transitionKey = transitionErrorKey("activate", error);
      if (transitionKey) {
        // Stale UI: re-gate by refetching the contract detail.
        queryClient.invalidateQueries({
          queryKey: ["contracts", "detail", contract.id],
        });
        setSubmitError(transitionKey);
        return;
      }
      setSubmitError("contracts.errors.activateFailed");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Field data-invalid={!!errors.mileage}>
          <FieldLabel htmlFor="activate-mileage">
            {t("contracts.detail.departureMileage")}
          </FieldLabel>
          <Input
            id="activate-mileage"
            type="number"
            inputMode="numeric"
            aria-invalid={!!errors.mileage}
            {...register("mileage")}
          />
          <FieldError errors={translatedError(t, errors.mileage)} />
        </Field>

        <Field data-invalid={!!errors.fuel}>
          <FieldLabel htmlFor="activate-fuel">
            {t("contracts.detail.departureFuel")}
          </FieldLabel>
          <Controller
            control={control}
            name="fuel"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  id="activate-fuel"
                  aria-label={t("contracts.detail.departureFuel")}
                >
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
          <FieldError errors={translatedError(t, errors.fuel)} />
        </Field>

        {submitError && <FieldError>{t(submitError)}</FieldError>}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {t("contracts.actions.activate")}
        </Button>
      </FieldGroup>
    </form>
  );
}
