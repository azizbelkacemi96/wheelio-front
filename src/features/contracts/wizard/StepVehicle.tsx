/**
 * Wizard step 1 — pick the vehicle. Reuses the fleet available-vehicles query
 * and only offers vehicles the user may operate in their agency
 * (canOperate(scope, agency_id)); the backend re-enforces create authz anyway
 * (04-RESEARCH.md Authorization / Pitfall 1). Selecting a vehicle writes
 * vehicle_id into the shared wizard form.
 */
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { useVehiclesQuery } from "@/features/fleet/queries";
import { useAuthStore } from "@/shared/auth/store";
import { canOperate } from "@/shared/auth/permissions";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/lib/utils";
import type { WizardValues } from "./schema";

export function StepVehicle() {
  const { t } = useTranslation();
  const scope = useAuthStore((s) => s.scope);
  const { watch, setValue } = useFormContext<WizardValues>();
  const selectedId = watch("vehicle_id");

  const query = useVehiclesQuery("available");
  const vehicles = (query.data ?? []).filter(
    (v) => scope !== null && canOperate(scope, v.agency_id),
  );

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-foreground">{t("wizard.vehicle.title")}</h2>

      {query.isPending ? (
        <div className="flex flex-col gap-2" data-testid="wizard-vehicle-loading">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : vehicles.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t("wizard.vehicle.noneAvailable")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {vehicles.map((v) => {
            const selected = v.id === selectedId;
            return (
              <li key={v.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    setValue("vehicle_id", v.id, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg border p-3 text-left transition-colors",
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted",
                  )}
                >
                  <span className="flex flex-col">
                    <span className="font-medium text-foreground">
                      {v.registration_plate}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {v.brand} {v.model}
                    </span>
                  </span>
                  {selected && (
                    <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
