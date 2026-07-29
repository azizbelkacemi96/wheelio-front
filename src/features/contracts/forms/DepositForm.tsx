/**
 * Record-deposit form (D-03 — the detail exposes the deposit).
 *
 * Minimal DZD amount + payment method, submitted via `useRecordDeposit`
 * (04-01). The amount is entered in DZD (D-10) and converted to integer
 * `amount_cents` by `toDepositBody`. Unlike the lifecycle transitions,
 * recording a deposit is not a status change, so there is no 409 re-gate here
 * — any failure shows the generic `recordDepositFailed` key.
 */
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
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
import { useRecordDeposit } from "../mutations";
import { depositSchema, toDepositBody, type DepositFormValues } from "../schemas";
import { translatedError } from "./formHelpers";

const resolver = zodResolver(depositSchema) as unknown as Resolver<DepositFormValues>;

const METHODS = ["cash", "card", "transfer"] as const;

export function DepositForm({
  contract,
  onDone,
}: {
  contract: ContractResponse;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const record = useRecordDeposit(contract.id);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DepositFormValues>({
    resolver,
    defaultValues: { amount_dzd: 0, method: "cash" },
  });

  async function onSubmit(values: DepositFormValues) {
    setSubmitError(null);
    try {
      await record.mutateAsync(toDepositBody(values));
      onDone();
    } catch {
      setSubmitError("contracts.errors.recordDepositFailed");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Field data-invalid={!!errors.amount_dzd}>
          <FieldLabel htmlFor="deposit-amount">
            {t("contracts.deposit.amount")}
          </FieldLabel>
          <Input
            id="deposit-amount"
            type="number"
            inputMode="decimal"
            aria-invalid={!!errors.amount_dzd}
            {...register("amount_dzd")}
          />
          <FieldError errors={translatedError(t, errors.amount_dzd)} />
        </Field>

        <Field>
          <FieldLabel htmlFor="deposit-method">
            {t("contracts.deposit.method")}
          </FieldLabel>
          <Controller
            control={control}
            name="method"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  id="deposit-method"
                  aria-label={t("contracts.deposit.method")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {t(`contracts.deposit.${method}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        {submitError && <FieldError>{t(submitError)}</FieldError>}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {t("contracts.actions.recordDeposit")}
        </Button>
      </FieldGroup>
    </form>
  );
}
