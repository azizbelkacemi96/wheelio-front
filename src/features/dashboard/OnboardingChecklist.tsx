/**
 * "Pour démarrer" — the first-run setup checklist on the `/` landing. Makes it
 * obvious what an owner must configure before the app is usable: fiscal
 * identity (+ logo), an agency, a first vehicle, a first customer. Completion
 * is read from GET /dashboard's `setup` block (server-computed), so a step
 * ticks itself the moment the underlying data exists. Shown only to org admins
 * (setup is their job) and only while at least one step is missing — once
 * everything is done it renders nothing, keeping the landing clean.
 */
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Building2, Car, CircleCheck, Circle, Rocket, Landmark, Users } from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/ui/button";
import type { DashboardResponse } from "@/types/dashboard";

type StepTo = "/admin/identite-fiscale" | "/admin/agences" | "/vehicules" | "/clients";

interface Step {
  key: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  to: StepTo;
  done: boolean;
}

export function OnboardingChecklist({ setup }: { setup: DashboardResponse["setup"] }) {
  const { t } = useTranslation();

  const steps: Step[] = [
    { key: "fiscal", icon: Landmark, to: "/admin/identite-fiscale", done: setup.has_fiscal_identity },
    { key: "agency", icon: Building2, to: "/admin/agences", done: setup.agencies > 0 },
    { key: "vehicle", icon: Car, to: "/vehicules", done: setup.vehicles > 0 },
    { key: "customer", icon: Users, to: "/clients", done: setup.customers > 0 },
  ];

  const done = steps.filter((s) => s.done).length;
  // Everything configured → nothing to guide, get out of the way.
  if (done === steps.length) return null;

  const pct = Math.round((done / steps.length) * 100);

  return (
    <section
      className="flex flex-col gap-4 rounded-xl border border-primary/25 bg-primary/5 p-5"
      aria-label={t("onboarding.title")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
            <Rocket className="size-5 text-primary" aria-hidden={true} />
            {t("onboarding.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("onboarding.subtitle")}</p>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-primary">
          {done}/{steps.length}
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/15">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>

      <ol className="flex flex-col gap-2">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <li
              key={step.key}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3",
                step.done ? "border-border bg-background/50" : "border-primary/30 bg-background",
              )}
            >
              {step.done ? (
                <CircleCheck className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden={true} />
              ) : (
                <Circle className="size-5 shrink-0 text-muted-foreground" aria-hidden={true} />
              )}
              <div className="flex min-w-0 flex-1 flex-col">
                <p
                  className={cn(
                    "flex items-center gap-1.5 text-sm font-medium text-foreground",
                    step.done && "text-muted-foreground line-through decoration-1",
                  )}
                >
                  <Icon className="size-3.5 shrink-0 opacity-70" aria-hidden={true} />
                  {t(`onboarding.steps.${step.key}.label`)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {t(`onboarding.steps.${step.key}.desc`)}
                </p>
              </div>
              {!step.done && (
                <Button asChild size="sm" variant="outline" className="shrink-0">
                  <Link to={step.to}>
                    {i === 0 ? t("onboarding.start") : t("onboarding.configure")}
                  </Link>
                </Button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
