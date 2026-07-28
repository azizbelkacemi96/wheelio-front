/**
 * Create-customer screen (CUST-01/CUST-02, 03-03-PLAN.md Task 3).
 *
 * ONE form with a radiogroup type toggle (individual|company) that swaps the
 * conditional field set — never two routes (research D-02). Extends the
 * Phase 1 auth-form pattern (react-hook-form + zodResolver(customerSchema) +
 * Field/FieldLabel/FieldError). `zodResolver` is cast to the flat
 * `CustomerFormValues` shape documented in schemas.ts — the runtime
 * validation still runs the real discriminated union + both refines; only
 * the compile-time field-path typing is relaxed so RHF's `register`/`Path`
 * resolve cleanly for a single toggled form.
 *
 * The company branch adds a drivers sub-form via `useFieldArray({ name:
 * "drivers" })`, keyed by `field.id` (never the array index — index keys
 * corrupt state on remove).
 *
 * On submit, `useCreateCustomerMutation` (mutations.ts) runs the
 * create-then-attach sequence. On full success we navigate to
 * `/clients/$customerId`. On PARTIAL failure (customer created, one or more
 * driver POSTs failed) we surface exactly which rows failed — naming each
 * by its own full_name — and offer a retry that re-attaches ONLY the failed
 * rows via `useAttachDriversMutation` against the already-created customer
 * id. `onSubmit` guards on `partialFailure` so neither a stray Enter-key
 * resubmission nor a second click can ever re-POST /customers once a
 * customer has been created (the partial-failure invariant, T-03-10); the
 * only path back to a normal submit is a page reload/new form.
 *
 * Gated with `hasOrgRole(scope, "agent")` — the org-wide axis (T-03-07),
 * never the per-agency `canOperate`. The backend re-enforces with its own
 * 403; this gate is UX only (D-08).
 */
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Loader2, Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
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
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { EmptyState } from "@/shared/ui/empty-state";
import { useAuthStore } from "@/shared/auth/store";
import { hasOrgRole } from "@/shared/auth/permissions";
import { customerSchema, type CustomerFormValues } from "./schemas";
import {
  useAttachDriversMutation,
  useCreateCustomerMutation,
  type DriverAttachResult,
} from "./mutations";

// See schemas.ts's CustomerFormValues doc comment: the resolver is cast to
// the flat RHF-friendly shape; the discriminated union + both refines still
// run at parse time.
const resolver = zodResolver(customerSchema) as unknown as Resolver<CustomerFormValues>;

/**
 * Zod validation messages on this schema are i18n KEYS (customers.errors.*),
 * never bare strings (schemas.ts). Resolve the key through `t()` before
 * handing it to `FieldError`, which otherwise renders `error.message`
 * verbatim — every field error boundary in this form goes through this
 * helper so no raw i18n key ever reaches the DOM.
 */
function translatedError(
  t: (key: string) => string,
  error?: { message?: string },
): Array<{ message?: string }> | undefined {
  return error?.message ? [{ message: t(error.message) }] : undefined;
}

export function CustomerCreateForm() {
  const scope = useAuthStore((s) => s.scope);

  if (!scope || !hasOrgRole(scope, "agent")) {
    return (
      <EmptyState
        titleKey="customers.create.notAuthorizedHeading"
        descriptionKey="customers.create.notAuthorizedBody"
      />
    );
  }

  return <CustomerCreateFormInner />;
}

interface PartialFailureState {
  customerId: string;
  results: DriverAttachResult[];
}

function CustomerCreateFormInner() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createMutation = useCreateCustomerMutation();
  const attachMutation = useAttachDriversMutation();

  const [createError, setCreateError] = useState<string | null>(null);
  const [partialFailure, setPartialFailure] = useState<PartialFailureState | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({
    resolver,
    defaultValues: { type: "individual", identity_doc_type: "cin", drivers: [] },
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: "drivers" });
  const type = watch("type");

  // Both discriminated-union branches carry `drivers` (schemas.ts), but only
  // the company branch renders/submits it. Toggling back to "individual"
  // must clear any rows added while on "company" — otherwise a still-blank
  // (still-invalid) drivers row silently fails validation on submit with no
  // rendered error anywhere, since drivers.* errors are only ever displayed
  // in the company branch (review CR-03).
  useEffect(() => {
    if (type === "individual") replace([]);
  }, [type, replace]);

  async function onSubmit(values: CustomerFormValues) {
    // Guard against any resubmission (Enter-key or a second click) once a
    // customer already exists from a prior partial-failure attempt — the
    // only allowed follow-up action is retryFailed(), never another
    // POST /customers.
    if (partialFailure) return;

    setCreateError(null);
    try {
      const outcome = await createMutation.mutateAsync(values);
      const failed = outcome.driverResults.filter((r) => !r.success);
      if (failed.length > 0) {
        setPartialFailure({ customerId: outcome.customer.id, results: outcome.driverResults });
        return;
      }
      await navigate({
        to: "/clients/$customerId",
        params: { customerId: outcome.customer.id },
      });
    } catch {
      setCreateError(t("customers.errors.createFailed"));
    }
  }

  async function retryFailed() {
    if (!partialFailure) return;
    const failedRows = partialFailure.results.filter((r) => !r.success);
    const results = await attachMutation.mutateAsync({
      customerId: partialFailure.customerId,
      drivers: failedRows.map((r) => r.body),
    });

    if (results.every((r) => r.success)) {
      await navigate({
        to: "/clients/$customerId",
        params: { customerId: partialFailure.customerId },
      });
      return;
    }
    setPartialFailure({ customerId: partialFailure.customerId, results });
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4 md:p-6">
      <Card className="[--card-spacing:1.5rem]">
        <CardHeader>
          <CardTitle>{t("customers.create.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <FieldGroup>
              <FieldSet>
                <FieldLegend>{t("customers.create.typeLegend")}</FieldLegend>
                <Controller
                  control={control}
                  name="type"
                  render={({ field }) => (
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      aria-label={t("customers.create.typeLegend")}
                      className="flex flex-row gap-4"
                    >
                      <FieldLabel
                        htmlFor="customer-type-individual"
                        className="flex items-center gap-2 font-normal"
                      >
                        <RadioGroupItem value="individual" id="customer-type-individual" />
                        {t("customers.create.individualLabel")}
                      </FieldLabel>
                      <FieldLabel
                        htmlFor="customer-type-company"
                        className="flex items-center gap-2 font-normal"
                      >
                        <RadioGroupItem value="company" id="customer-type-company" />
                        {t("customers.create.companyLabel")}
                      </FieldLabel>
                    </RadioGroup>
                  )}
                />
              </FieldSet>

              {type === "individual" ? (
                <>
                  <Field data-invalid={!!errors.full_name}>
                    <FieldLabel htmlFor="full_name">{t("customers.fields.fullName")}</FieldLabel>
                    <Input
                      id="full_name"
                      aria-invalid={!!errors.full_name}
                      {...register("full_name")}
                    />
                    <FieldError errors={translatedError(t, errors.full_name)} />
                  </Field>

                  <Field data-invalid={!!errors.identity_doc_type}>
                    <FieldLabel htmlFor="identity_doc_type">
                      {t("customers.fields.identityDocType")}
                    </FieldLabel>
                    <Controller
                      control={control}
                      name="identity_doc_type"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger
                            id="identity_doc_type"
                            aria-label={t("customers.fields.identityDocType")}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cin">{t("customers.identityDocType.cin")}</SelectItem>
                            <SelectItem value="passport">
                              {t("customers.identityDocType.passport")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </Field>

                  <Field data-invalid={!!errors.identity_doc_number}>
                    <FieldLabel htmlFor="identity_doc_number">
                      {t("customers.fields.identityDocNumber")}
                    </FieldLabel>
                    <Input
                      id="identity_doc_number"
                      aria-invalid={!!errors.identity_doc_number}
                      {...register("identity_doc_number")}
                    />
                    <FieldError errors={translatedError(t, errors.identity_doc_number)} />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="license_number">
                      {t("customers.fields.licenseNumber")}
                    </FieldLabel>
                    <Input id="license_number" {...register("license_number")} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="license_issued_at">
                      {t("customers.fields.licenseIssuedAt")}
                    </FieldLabel>
                    <Input id="license_issued_at" type="date" {...register("license_issued_at")} />
                  </Field>
                  <Field data-invalid={!!errors.license_valid_until}>
                    <FieldLabel htmlFor="license_valid_until">
                      {t("customers.fields.licenseValidUntil")}
                    </FieldLabel>
                    <Input
                      id="license_valid_until"
                      type="date"
                      aria-invalid={!!errors.license_valid_until}
                      {...register("license_valid_until")}
                    />
                    <FieldError errors={translatedError(t, errors.license_valid_until)} />
                  </Field>
                </>
              ) : (
                <>
                  <Field data-invalid={!!errors.legal_name}>
                    <FieldLabel htmlFor="legal_name">{t("customers.fields.legalName")}</FieldLabel>
                    <Input
                      id="legal_name"
                      aria-invalid={!!errors.legal_name}
                      {...register("legal_name")}
                    />
                    <FieldError errors={translatedError(t, errors.legal_name)} />
                  </Field>
                  <Field data-invalid={!!errors.rc}>
                    <FieldLabel htmlFor="rc">{t("customers.fields.rc")}</FieldLabel>
                    <Input id="rc" aria-invalid={!!errors.rc} {...register("rc")} />
                    <FieldError errors={translatedError(t, errors.rc)} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="nif">{t("customers.fields.nif")}</FieldLabel>
                    <Input id="nif" {...register("nif")} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="nis">{t("customers.fields.nis")}</FieldLabel>
                    <Input id="nis" {...register("nis")} />
                  </Field>

                  <FieldSet>
                    <FieldLegend>{t("customers.drivers.title")}</FieldLegend>
                    {fields.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        {t("customers.drivers.empty")}
                      </p>
                    )}
                    {fields.map((field, index) => (
                      <div
                        key={field.id}
                        data-testid={`driver-row-${index}`}
                        className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-end"
                      >
                        <Field className="flex-1">
                          <FieldLabel htmlFor={`drivers.${index}.full_name`}>
                            {t("customers.drivers.fullName")}
                          </FieldLabel>
                          <Input
                            id={`drivers.${index}.full_name`}
                            aria-invalid={!!errors.drivers?.[index]?.full_name}
                            {...register(`drivers.${index}.full_name` as const)}
                          />
                          <FieldError
                            errors={translatedError(t, errors.drivers?.[index]?.full_name)}
                          />
                        </Field>
                        <Field className="flex-1">
                          <FieldLabel htmlFor={`drivers.${index}.license_number`}>
                            {t("customers.drivers.licenseNumber")}
                          </FieldLabel>
                          <Input
                            id={`drivers.${index}.license_number`}
                            aria-invalid={!!errors.drivers?.[index]?.license_number}
                            {...register(`drivers.${index}.license_number` as const)}
                          />
                          <FieldError
                            errors={translatedError(t, errors.drivers?.[index]?.license_number)}
                          />
                        </Field>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => remove(index)}
                          aria-label={t("customers.drivers.remove")}
                        >
                          <X className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => append({ full_name: "", license_number: "" })}
                    >
                      <Plus className="size-4" aria-hidden="true" />
                      {t("customers.drivers.add")}
                    </Button>
                  </FieldSet>
                </>
              )}

              <Field>
                <FieldLabel htmlFor="phone">{t("customers.fields.phone")}</FieldLabel>
                <Input id="phone" {...register("phone")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="address">{t("customers.fields.address")}</FieldLabel>
                <Input id="address" {...register("address")} />
              </Field>

              {createError && <FieldError>{createError}</FieldError>}

              {partialFailure ? (
                <div
                  role="alert"
                  className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3"
                >
                  <p className="text-sm font-medium text-destructive">
                    {t("customers.errors.partialSuccess")}
                  </p>
                  <ul className="ml-4 flex list-disc flex-col gap-1 text-sm text-destructive">
                    {partialFailure.results
                      .filter((r) => !r.success)
                      .map((r) => (
                        <li key={r.index}>
                          {r.body.full_name} — {t("customers.errors.driverFailed")}
                        </li>
                      ))}
                  </ul>
                  <Button
                    type="button"
                    onClick={retryFailed}
                    disabled={attachMutation.isPending}
                    className="w-fit"
                  >
                    {attachMutation.isPending && (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    )}
                    {t("customers.retry")}
                  </Button>
                </div>
              ) : (
                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                  {t("customers.create.submit")}
                </Button>
              )}
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
