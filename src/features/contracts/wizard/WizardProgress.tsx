/**
 * Hand-authored 4-step progress indicator for the rental wizard (no stepper
 * package — 04-RESEARCH.md). The active step carries aria-current="step" so
 * assistive tech and tests can locate it; completed steps read distinct from
 * upcoming ones.
 */
import { cn } from "@/lib/utils";

export interface WizardProgressProps {
  steps: string[];
  activeIndex: number;
}

export function WizardProgress({ steps, activeIndex }: WizardProgressProps) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {steps.map((label, i) => {
        const state =
          i < activeIndex ? "complete" : i === activeIndex ? "active" : "upcoming";
        return (
          <li
            key={label}
            aria-current={i === activeIndex ? "step" : undefined}
            className="flex items-center gap-2"
          >
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-medium",
                state === "active" && "border-primary bg-primary text-primary-foreground",
                state === "complete" && "border-primary text-primary",
                state === "upcoming" && "border-border text-muted-foreground",
              )}
            >
              {i + 1}
            </span>
            <span
              className={cn(
                "text-sm",
                i === activeIndex ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <span className="mx-1 hidden h-px w-6 bg-border sm:inline-block" aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
