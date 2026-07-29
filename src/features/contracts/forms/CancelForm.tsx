/**
 * Cancel form (RENT-04).
 *
 * Records a required, non-empty reason and moves the contract to `cancelled`
 * via `useCancel` (04-01). A reserved OR active contract can be cancelled
 * (the parent gates the button on status ∈ {reserved, active}).
 *
 * A 409 is a stale-UI illegal transition -> DISTINCT `notCancellable` message
 * + a detail refetch so the parent re-gates (Pitfall 2 / T-04-05); any non-409
 * failure shows the generic `cancelFailed` key.
 */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { ContractResponse } from "@/types/rental";
import { Button } from "@/shared/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/shared/ui/field";
import { useCancel, transitionErrorKey } from "../mutations";
import { cancelSchema, type CancelFormValues } from "../schemas";
import { translatedError } from "./formHelpers";

export function CancelForm({
  contract,
  onDone,
}: {
  contract: ContractResponse;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const cancel = useCancel(contract.id);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CancelFormValues>({
    resolver: zodResolver(cancelSchema),
    defaultValues: { reason: "" },
  });

  async function onSubmit(values: CancelFormValues) {
    setSubmitError(null);
    try {
      await cancel.mutateAsync({ reason: values.reason });
      onDone();
    } catch (error) {
      const transitionKey = transitionErrorKey("cancel", error);
      if (transitionKey) {
        queryClient.invalidateQueries({
          queryKey: ["contracts", "detail", contract.id],
        });
        setSubmitError(transitionKey);
        return;
      }
      setSubmitError("contracts.errors.cancelFailed");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Field data-invalid={!!errors.reason}>
          <FieldLabel htmlFor="cancel-reason">
            {t("contracts.forms.reason")}
          </FieldLabel>
          <textarea
            id="cancel-reason"
            rows={3}
            aria-invalid={!!errors.reason}
            className="flex min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive"
            {...register("reason")}
          />
          <FieldError errors={translatedError(t, errors.reason)} />
        </Field>

        {submitError && <FieldError>{t(submitError)}</FieldError>}

        <Button type="submit" variant="destructive" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {t("contracts.forms.cancelSubmit")}
        </Button>
      </FieldGroup>
    </form>
  );
}
