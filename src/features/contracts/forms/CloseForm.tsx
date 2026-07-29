/**
 * Close (end-of-rental) form (RENT-03).
 *
 * Records the return state — mileage + fuel — and the invoice: a repeatable
 * invoice-lines sub-form via `useFieldArray` (keyed by field.id, never the
 * index — index keys corrupt state on remove, mirroring Phase 3's drivers
 * array). At least ONE line is required (RENT-03); each carries a DZD amount
 * entered by a human (D-10) that `toCloseBody` converts to integer
 * `unit_price_ht_cents` (Pitfall 5). Moves the contract active -> closed via
 * `useClose` (04-01).
 *
 * A 409 is a stale-UI illegal transition -> DISTINCT `notClosable` message +
 * a detail refetch so the parent re-gates (Pitfall 2 / T-04-05); any non-409
 * failure shows the generic `closeFailed` key.
 */
import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, X } from "lucide-react";
import type { ContractResponse } from "@/types/rental";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/shared/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { useClose, transitionErrorKey } from "../mutations";
import { closeSchema, toCloseBody, type CloseFormValues } from "../schemas";
import { FUEL_LEVELS, translatedError } from "./formHelpers";

// zod `coerce` widens the resolver INPUT type to `unknown`; cast to the parsed
// output shape so RHF's register/useFieldArray typing resolves (runtime still
// coerces + validates — the CustomerCreateForm idiom).
const resolver = zodResolver(closeSchema) as unknown as Resolver<CloseFormValues>;

export function CloseForm({
  contract,
  onDone,
}: {
  contract: ContractResponse;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const close = useClose(contract.id);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CloseFormValues>({
    resolver,
    defaultValues: {
      mileage: 0,
      fuel: "full",
      invoice_lines: [
        { description: "", quantity: 1, amount_dzd: 0, vat_rate: 19 },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "invoice_lines",
  });

  // zod's array-level min(1) error lands on `.root` (useFieldArray) — fall
  // back to a direct `.message` across resolver versions.
  const linesError =
    errors.invoice_lines?.root ??
    (errors.invoice_lines as { message?: string } | undefined);

  async function onSubmit(values: CloseFormValues) {
    setSubmitError(null);
    try {
      await close.mutateAsync(toCloseBody(values));
      onDone();
    } catch (error) {
      const transitionKey = transitionErrorKey("close", error);
      if (transitionKey) {
        queryClient.invalidateQueries({
          queryKey: ["contracts", "detail", contract.id],
        });
        setSubmitError(transitionKey);
        return;
      }
      setSubmitError("contracts.errors.closeFailed");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Field data-invalid={!!errors.mileage}>
          <FieldLabel htmlFor="close-mileage">
            {t("contracts.detail.returnMileage")}
          </FieldLabel>
          <Input
            id="close-mileage"
            type="number"
            inputMode="numeric"
            aria-invalid={!!errors.mileage}
            {...register("mileage")}
          />
          <FieldError errors={translatedError(t, errors.mileage)} />
        </Field>

        <Field data-invalid={!!errors.fuel}>
          <FieldLabel htmlFor="close-fuel">
            {t("contracts.detail.returnFuel")}
          </FieldLabel>
          <Controller
            control={control}
            name="fuel"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  id="close-fuel"
                  aria-label={t("contracts.detail.returnFuel")}
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

        <FieldSet>
          <FieldLegend>{t("contracts.forms.invoiceLines")}</FieldLegend>
          {fields.map((field, index) => (
            <div
              key={field.id}
              data-testid={`invoice-line-${index}`}
              className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-end"
            >
              <Field className="flex-1">
                <FieldLabel htmlFor={`invoice_lines.${index}.description`}>
                  {t("contracts.forms.lineDescription")}
                </FieldLabel>
                <Input
                  id={`invoice_lines.${index}.description`}
                  aria-invalid={!!errors.invoice_lines?.[index]?.description}
                  {...register(`invoice_lines.${index}.description` as const)}
                />
                <FieldError
                  errors={translatedError(t, errors.invoice_lines?.[index]?.description)}
                />
              </Field>
              <Field className="w-full sm:w-20">
                <FieldLabel htmlFor={`invoice_lines.${index}.quantity`}>
                  {t("contracts.forms.lineQuantity")}
                </FieldLabel>
                <Input
                  id={`invoice_lines.${index}.quantity`}
                  type="number"
                  inputMode="numeric"
                  aria-invalid={!!errors.invoice_lines?.[index]?.quantity}
                  {...register(`invoice_lines.${index}.quantity` as const)}
                />
                <FieldError
                  errors={translatedError(t, errors.invoice_lines?.[index]?.quantity)}
                />
              </Field>
              <Field className="w-full sm:w-32">
                <FieldLabel htmlFor={`invoice_lines.${index}.amount_dzd`}>
                  {t("contracts.forms.lineAmount")}
                </FieldLabel>
                <Input
                  id={`invoice_lines.${index}.amount_dzd`}
                  type="number"
                  inputMode="decimal"
                  aria-invalid={!!errors.invoice_lines?.[index]?.amount_dzd}
                  {...register(`invoice_lines.${index}.amount_dzd` as const)}
                />
                <FieldError
                  errors={translatedError(t, errors.invoice_lines?.[index]?.amount_dzd)}
                />
              </Field>
              <Field className="w-full sm:w-24">
                <FieldLabel htmlFor={`invoice_lines.${index}.vat_rate`}>
                  {t("contracts.forms.lineVat")}
                </FieldLabel>
                <Input
                  id={`invoice_lines.${index}.vat_rate`}
                  type="number"
                  inputMode="numeric"
                  aria-invalid={!!errors.invoice_lines?.[index]?.vat_rate}
                  {...register(`invoice_lines.${index}.vat_rate` as const)}
                />
                <FieldError
                  errors={translatedError(t, errors.invoice_lines?.[index]?.vat_rate)}
                />
              </Field>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => remove(index)}
                aria-label={t("contracts.forms.removeLine")}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
          <FieldError errors={translatedError(t, linesError)} />
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              append({ description: "", quantity: 1, amount_dzd: 0, vat_rate: 19 })
            }
          >
            <Plus className="size-4" aria-hidden="true" />
            {t("contracts.forms.addLine")}
          </Button>
        </FieldSet>

        {submitError && <FieldError>{t(submitError)}</FieldError>}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {t("contracts.actions.close")}
        </Button>
      </FieldGroup>
    </form>
  );
}
