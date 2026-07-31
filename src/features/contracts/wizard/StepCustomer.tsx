/**
 * Wizard step 2 — pick or create the customer. "Pick existing" reuses the
 * org-scoped customer search (useCustomersQuery); "create new" reuses
 * useCreateCustomerMutation for a minimal inline individual record. Either
 * path ends by writing customer_id into the shared wizard form.
 *
 * The inline create uses local state (not a nested RHF form) so it never
 * collides with the wizard's own FormProvider.
 */
import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Check, Loader2 } from "lucide-react";
import { useCustomersQuery } from "@/features/customers/queries";
import { useCreateCustomerMutation } from "@/features/customers/mutations";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Field, FieldLabel } from "@/shared/ui/field";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/lib/utils";
import type { CustomerResponse } from "@/types/customer";
import type { WizardValues } from "./schema";

function displayName(c: CustomerResponse): string {
  return c.type === "company" ? (c.legal_name ?? "") : (c.full_name ?? "");
}

export function StepCustomer() {
  const { t } = useTranslation();
  const { watch, setValue } = useFormContext<WizardValues>();
  const selectedId = watch("customer_id");
  const [mode, setMode] = useState<"existing" | "new">("existing");

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-foreground">{t("wizard.customer.title")}</h2>

      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === "existing" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("existing")}
        >
          {t("wizard.customer.pickExisting")}
        </Button>
        <Button
          type="button"
          variant={mode === "new" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("new")}
        >
          {t("wizard.customer.createNew")}
        </Button>
      </div>

      {mode === "existing" ? (
        <ExistingCustomerPicker
          selectedId={selectedId}
          onPick={(id) => setValue("customer_id", id, { shouldValidate: true, shouldDirty: true })}
        />
      ) : (
        <InlineCustomerCreate
          onCreated={(id) => {
            setValue("customer_id", id, { shouldValidate: true, shouldDirty: true });
            setMode("existing");
          }}
        />
      )}
    </section>
  );
}

function ExistingCustomerPicker({
  selectedId,
  onPick,
}: {
  selectedId?: string;
  onPick: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const query = useCustomersQuery(q);
  const customers = query.data ?? [];

  return (
    <div className="flex flex-col gap-2">
      <Input
        type="search"
        aria-label={t("wizard.customer.searchPlaceholder")}
        placeholder={t("wizard.customer.searchPlaceholder")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {query.isPending ? (
        <Skeleton className="h-10 w-full" />
      ) : (
        <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
          {customers.map((c) => {
            const selected = c.id === selectedId;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onPick(c.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg border p-3 text-left transition-colors",
                    selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
                  )}
                >
                  <span className="font-medium text-foreground">{displayName(c)}</span>
                  {selected && <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function InlineCustomerCreate({ onCreated }: { onCreated: (id: string) => void }) {
  const { t } = useTranslation();
  const createMutation = useCreateCustomerMutation();
  const [fullName, setFullName] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setError(null);
    try {
      const result = await createMutation.mutateAsync({
        type: "individual",
        full_name: fullName,
        identity_doc_type: "cin",
        identity_doc_number: docNumber,
        license_number: licenseNumber,
        drivers: [],
      });
      onCreated(result.customer.id);
    } catch {
      setError(t("customers.errors.createFailed"));
    }
  }

  const canCreate = fullName.trim() !== "" && docNumber.trim() !== "";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <Field>
        <FieldLabel htmlFor="wizard-cust-name">{t("customers.fields.fullName")}</FieldLabel>
        <Input id="wizard-cust-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="wizard-cust-doc">{t("customers.fields.identityDocNumber")}</FieldLabel>
        <Input id="wizard-cust-doc" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="wizard-cust-license">{t("customers.fields.licenseNumber")}</FieldLabel>
        <Input
          id="wizard-cust-license"
          value={licenseNumber}
          onChange={(e) => setLicenseNumber(e.target.value)}
        />
      </Field>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        type="button"
        onClick={create}
        disabled={!canCreate || createMutation.isPending}
        className="w-fit"
      >
        {createMutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {t("wizard.customer.createNew")}
      </Button>
    </div>
  );
}
