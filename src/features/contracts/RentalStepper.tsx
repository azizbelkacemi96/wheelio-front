/**
 * Rental lifecycle stepper — shows where a contract is in its journey
 * (Réservé → En cours → Clôturé) so the user always knows the current stage and
 * what's done. A cancelled contract shows a distinct banner instead of a stage.
 */
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContractStatus } from "@/types/rental";

const STEPS = ["reserved", "active", "closed"] as const;

export function RentalStepper({ status }: { status: ContractStatus }) {
  const { t } = useTranslation();

  if (status === "cancelled") {
    return (
      <div
        role="status"
        className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive"
      >
        {t("contracts.detail.cancelledNote")}
      </div>
    );
  }

  const current = STEPS.indexOf(status as (typeof STEPS)[number]);

  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={step} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                done && "border-primary bg-primary text-primary-foreground",
                active && "border-primary text-primary",
                !done && !active && "border-border text-muted-foreground",
              )}
            >
              {done ? <Check className="size-4" aria-hidden={true} /> : i + 1}
            </span>
            <span
              className={cn(
                "whitespace-nowrap text-sm",
                active ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {t(`contracts.status.${step}`)}
            </span>
            {i < STEPS.length - 1 && (
              <span className={cn("h-px flex-1", done ? "bg-primary" : "bg-border")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
