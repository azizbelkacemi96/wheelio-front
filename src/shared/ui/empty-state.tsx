/**
 * Shared empty-state block for placeholder/stub pages (01-UI-SPEC.md
 * "Copywriting Contract" + "UI Considerations" placeholder row): a centered
 * heading + body sourced from i18n keys so the copy is locale-reactive
 * (FR "Bientôt disponible" default, EN "Coming soon" on switch — AUTH-05).
 *
 * Defaults to the phase's "coming soon" copy; later phases can reuse it for
 * genuine zero-data states by overriding the keys (e.g. "vehicles.empty").
 * Never hardcode the copy as bare JSX literals — keys only (D-08 prohibition
 * in 01-07-PLAN.md).
 */
import { useTranslation } from "react-i18next";
import { CarIllustration } from "./illustrations";

export interface EmptyStateProps {
  /** i18n key for the heading — defaults to the "Bientôt disponible"/"Coming soon" contract copy. */
  titleKey?: string;
  /** i18n key for the body — defaults to the matching contract body copy. */
  descriptionKey?: string;
  /** Show the car illustration above the copy (genuine zero-data states). */
  car?: boolean;
}

export function EmptyState({
  titleKey = "emptyState.heading",
  descriptionKey = "emptyState.body",
  car = false,
}: EmptyStateProps) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[50svh] flex-col items-center justify-center gap-2 p-6 text-center">
      {car && <CarIllustration className="mb-2 h-20 w-52 text-muted-foreground/40" />}
      <h1 className="text-xl font-semibold text-foreground">{t(titleKey)}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{t(descriptionKey)}</p>
    </div>
  );
}
