/**
 * Compact KPI card — an icon in a tinted tile + a big number + a label (and an
 * optional hint). Used to give the dashboard at-a-glance figures.
 */
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/shared/ui/card";

type Tone = "default" | "primary" | "success" | "warning";

const TONE: Record<Tone, string> = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <Card className="flex flex-row items-center gap-3 p-4">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          TONE[tone],
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-2xl font-semibold leading-none text-foreground">{value}</span>
        <span className="truncate text-sm text-muted-foreground">{label}</span>
        {hint && <span className="truncate text-xs text-muted-foreground">{hint}</span>}
      </div>
    </Card>
  );
}
