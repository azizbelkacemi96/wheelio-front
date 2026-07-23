import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

/**
 * Temporary landing page for the authenticated "/" route — the real
 * "Aujourd'hui" dashboard is out of this plan's scope (01-07 builds the
 * placeholder/empty-state feature routes). This exists only so AppShell's
 * <Outlet /> has a child to render once the guard passes.
 */
export const Route = createFileRoute("/_authenticated/")({
  component: DashboardPlaceholder,
});

function DashboardPlaceholder() {
  const { t } = useTranslation();
  return (
    <div>
      <h1 className="text-2xl font-semibold">{t("nav.today")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("emptyState.body")}</p>
    </div>
  );
}
