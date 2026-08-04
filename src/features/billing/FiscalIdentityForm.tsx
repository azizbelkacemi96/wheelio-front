/**
 * Company fiscal-identity management (BILL-01) at /admin/identite-fiscale.
 * Org-admin only (isOrgAdmin) — the identity is the legal header of every
 * issued invoice. NIF / NIS / legal form / address are REQUIRED here because
 * the backend blocks invoice issuance (contract close) without them
 * (service.go:100) — that is the "blocking gate", enforced at data entry.
 *
 * There is no GET endpoint for the fiscal identity, so the form pre-fills only
 * from the PATCH response cached this session (FISCAL_IDENTITY_KEY); on a cold
 * load it starts empty and the admin (re)enters the mandatory mentions.
 */
import { useRef, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload } from "lucide-react";
import { useAuthStore } from "@/shared/auth/store";
import { isOrgAdmin } from "@/shared/auth/permissions";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { EmptyState } from "@/shared/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Field, FieldError, FieldLabel } from "@/shared/ui/field";
import type { FiscalIdentityBody, OrgFiscalIdentityResponse } from "@/types/billing";
import { fiscalIdentitySchema, type FiscalIdentityValues } from "./schema";
import {
  FISCAL_IDENTITY_KEY,
  useUpdateFiscalIdentity,
  useUploadOrgLogo,
} from "./mutations";

export function FiscalIdentityForm() {
  const { t } = useTranslation();
  const scope = useAuthStore((s) => s.scope);
  const queryClient = useQueryClient();
  const updateMutation = useUpdateFiscalIdentity();

  const cached = queryClient.getQueryData<OrgFiscalIdentityResponse>(FISCAL_IDENTITY_KEY);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FiscalIdentityValues>({
    resolver: zodResolver(fiscalIdentitySchema) as unknown as Resolver<FiscalIdentityValues>,
    defaultValues: {
      legal_form: cached?.legal_form ?? "",
      nif: cached?.nif ?? "",
      nis: cached?.nis ?? "",
      address_line: cached?.address_line ?? "",
      tax_article_number: cached?.tax_article_number ?? "",
      commerce_register_number: cached?.commerce_register_number ?? "",
      city: cached?.city ?? "",
      postal_code: cached?.postal_code ?? "",
    },
  });

  if (!scope || !isOrgAdmin(scope)) {
    return (
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <EmptyState
          titleKey="billing.fiscal.notAuthorizedHeading"
          descriptionKey="billing.fiscal.notAuthorizedBody"
        />
      </div>
    );
  }

  const submit = handleSubmit((values) => {
    const body: FiscalIdentityBody = {
      legal_form: values.legal_form,
      nif: values.nif,
      nis: values.nis,
      address_line: values.address_line,
      tax_article_number: values.tax_article_number ?? "",
      commerce_register_number: values.commerce_register_number ?? "",
      city: values.city ?? "",
      postal_code: values.postal_code ?? "",
    };
    updateMutation.mutate(body);
  });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-semibold text-foreground">
          {t("billing.fiscal.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("billing.fiscal.subtitle")}</p>
      </header>

      <LogoCard />

      <Card>
        <CardHeader>
          <CardTitle>{t("billing.fiscal.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-3">
            <RequiredField
              id="legal_form"
              label={t("billing.fiscal.legalForm")}
              error={errors.legal_form?.message}
              register={register("legal_form")}
            />
            <RequiredField
              id="nif"
              label={t("billing.fiscal.nif")}
              error={errors.nif?.message}
              register={register("nif")}
            />
            <RequiredField
              id="nis"
              label={t("billing.fiscal.nis")}
              error={errors.nis?.message}
              register={register("nis")}
            />
            <RequiredField
              id="address_line"
              label={t("billing.fiscal.addressLine")}
              error={errors.address_line?.message}
              register={register("address_line")}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="tax_article_number">{t("billing.fiscal.taxArticleNumber")}</FieldLabel>
                <Input id="tax_article_number" {...register("tax_article_number")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="commerce_register_number">{t("billing.fiscal.commerceRegisterNumber")}</FieldLabel>
                <Input id="commerce_register_number" {...register("commerce_register_number")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="city">{t("billing.fiscal.city")}</FieldLabel>
                <Input id="city" {...register("city")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="postal_code">{t("billing.fiscal.postalCode")}</FieldLabel>
                <Input id="postal_code" {...register("postal_code")} />
              </Field>
            </div>

            {updateMutation.isError && (
              <p role="alert" className="text-sm text-destructive">
                {t("billing.errors.fiscalFailed")}
              </p>
            )}
            {updateMutation.isSuccess && (
              <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">
                {t("billing.fiscal.success")}
              </p>
            )}

            <div>
              <Button type="submit" disabled={updateMutation.isPending}>
                {t("billing.fiscal.submit")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function RequiredField({
  id,
  label,
  error,
  register,
}: {
  id: string;
  label: string;
  error?: string;
  register: ReturnType<ReturnType<typeof useForm>["register"]>;
}) {
  const { t } = useTranslation();
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>
        {label} <span className="text-destructive">*</span>
      </FieldLabel>
      <Input id={id} aria-invalid={!!error} {...register} />
      <FieldError errors={error ? [{ message: t(error) }] : undefined} />
      <span className="text-xs text-muted-foreground">{t("billing.fiscal.requiredHint")}</span>
    </Field>
  );
}

/** Company logo upload (embedded in the contract PDF header). */
function LogoCard() {
  const { t } = useTranslation();
  const mutation = useUploadOrgLogo();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  const onFile = (f?: File) => {
    if (!f) return;
    setName(f.name);
    setPreview(URL.createObjectURL(f));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("billing.fiscal.logoTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{t("billing.fiscal.logoHint")}</p>
        <div className="flex flex-wrap items-center gap-3">
          {preview && (
            <img
              src={preview}
              alt=""
              className="h-12 max-w-[150px] rounded border border-border bg-white object-contain p-1"
            />
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" aria-hidden={true} />
            {t("billing.fiscal.logoChoose")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label={t("billing.fiscal.logoChoose")}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          {name && <span className="truncate text-sm text-muted-foreground">{name}</span>}
          <Button
            type="button"
            size="sm"
            className="ml-auto"
            disabled={!name || mutation.isPending}
            onClick={() => {
              const f = fileRef.current?.files?.[0];
              if (f) mutation.mutate(f);
            }}
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden={true} />}
            {t("billing.fiscal.logoUpload")}
          </Button>
        </div>
        {mutation.isError && (
          <p role="alert" className="text-sm text-destructive">
            {t("billing.fiscal.logoError")}
          </p>
        )}
        {mutation.isSuccess && (
          <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">
            {t("billing.fiscal.logoSuccess")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
