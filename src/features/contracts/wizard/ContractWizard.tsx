/**
 * Guided rental wizard (RENT-05) — ONE React Hook Form on ONE route, with a
 * local step index. RHF retains values across step unmount (shouldUnregister
 * default false), so Back never loses data. Next is gated by
 * trigger(STEP_FIELDS[step]).
 *
 * Finish runs the real create → (optional deposit) → (optional activate)
 * sequence with a partial-failure invariant: the created contract id is held
 * in state, so a retry after a deposit/activate failure NEVER re-POSTs create
 * (no duplicate contract, no second overlap check) — the same discipline as
 * Phase 3's customer create-then-attach. A create-time 409 surfaces the
 * friendly overlap message and keeps the user in the wizard to adjust
 * dates/vehicle.
 */
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/shared/auth/store";
import { hasOrgRole } from "@/shared/auth/permissions";
import { EmptyState } from "@/shared/ui/empty-state";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import {
  activateContract,
  createContract,
  recordDeposit,
} from "@/features/contracts/api";
import { overlapErrorKey } from "@/features/contracts/mutations";
import { toRFC3339Algiers } from "@/features/contracts/dateAlgiers";
import { STEP_FIELDS, wizardSchema, type WizardValues } from "./schema";
import { WizardProgress } from "./WizardProgress";
import { StepVehicle } from "./StepVehicle";
import { StepCustomer } from "./StepCustomer";
import { StepTerms } from "./StepTerms";
import { StepDeparture } from "./StepDeparture";

// The schema's coerce/optional fields make its input and output types differ;
// the cast relaxes only compile-time typing (the CustomerCreateForm idiom) —
// runtime validation still runs the full schema incl. the ends>starts refine.
const resolver = zodResolver(wizardSchema) as unknown as Resolver<WizardValues>;

export function ContractWizard() {
  const scope = useAuthStore((s) => s.scope);

  if (!scope || !hasOrgRole(scope, "agent")) {
    return (
      <EmptyState
        titleKey="contracts.detail.notFoundHeading"
        descriptionKey="contracts.detail.notAuthorized"
      />
    );
  }

  return <ContractWizardInner />;
}

function ContractWizardInner() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const methods = useForm<WizardValues>({
    resolver,
    defaultValues: { activate_now: true },
  });
  const { trigger, getValues } = methods;

  const [step, setStep] = useState(0);
  // Partial-failure guard: once create succeeds this holds the id so a retry
  // resumes at deposit/activate and never re-POSTs create.
  const [createdContractId, setCreatedContractId] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  const steps = [
    t("wizard.steps.vehicle"),
    t("wizard.steps.customer"),
    t("wizard.steps.terms"),
    t("wizard.steps.departure"),
  ];
  const isLast = step === STEP_FIELDS.length - 1;

  async function next() {
    const valid = await trigger([...STEP_FIELDS[step]]);
    if (valid) setStep((s) => Math.min(s + 1, STEP_FIELDS.length - 1));
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function finish() {
    const valid = await trigger();
    if (!valid) return;
    const values = getValues();
    setFinishing(true);
    setFinishError(null);
    try {
      let contractId = createdContractId;
      // Step A — create (skipped if a prior attempt already created it).
      if (!contractId) {
        const contract = await createContract(values.vehicle_id, {
          customer_id: values.customer_id,
          starts_at: toRFC3339Algiers(values.starts_at_local),
          ends_at: toRFC3339Algiers(values.ends_at_local),
        });
        contractId = contract.id;
        setCreatedContractId(contractId);
      }
      // Step B — optional deposit.
      if (values.deposit_amount != null && values.deposit_method) {
        await recordDeposit(contractId, {
          amount_cents: Math.round(values.deposit_amount * 100),
          method: values.deposit_method,
        });
      }
      // Step C — optional activation (departure mileage + fuel).
      if (values.activate_now) {
        await activateContract(contractId, {
          mileage: values.departure_mileage,
          fuel: values.departure_fuel,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      await navigate({ to: "/contrats/$contractId", params: { contractId } });
    } catch (err) {
      const overlap = overlapErrorKey(err);
      if (overlap) {
        // Create-time overlap — stay in the wizard so the user can change the
        // period or vehicle; nothing was created.
        setFinishError(t(overlap));
      } else if (createdContractId) {
        // Create already succeeded; a deposit/activate step failed. Offer to
        // finish on the detail screen (retry re-runs finish without re-create).
        setFinishError(t("contracts.errors.activateFailed"));
      } else {
        setFinishError(t("contracts.errors.createFailed"));
      }
    } finally {
      setFinishing(false);
    }
  }

  return (
    <FormProvider {...methods}>
      <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4 md:p-6">
        <h1 className="font-heading text-xl font-semibold text-foreground">
          {t("wizard.title")}
        </h1>
        <WizardProgress steps={steps} activeIndex={step} />

        <Card>
          <CardContent className="pt-6">
            {step === 0 && <StepVehicle />}
            {step === 1 && <StepCustomer />}
            {step === 2 && <StepTerms />}
            {step === 3 && <StepDeparture />}

            {finishError && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {finishError}
                {createdContractId && (
                  <>
                    {" "}
                    <button
                      type="button"
                      className="underline"
                      onClick={() =>
                        navigate({
                          to: "/contrats/$contractId",
                          params: { contractId: createdContractId },
                        })
                      }
                    >
                      {t("contracts.actions.backToList")}
                    </button>
                  </>
                )}
              </p>
            )}

            <div className="mt-6 flex items-center justify-between gap-2">
              <Button type="button" variant="outline" onClick={back} disabled={step === 0}>
                {t("wizard.nav.back")}
              </Button>
              {isLast ? (
                <Button type="button" onClick={finish} disabled={finishing}>
                  {finishing && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                  {t("wizard.nav.finish")}
                </Button>
              ) : (
                <Button type="button" onClick={next}>
                  {t("wizard.nav.next")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </FormProvider>
  );
}
