import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/shared/ui/empty-state";

/**
 * "Aujourd'hui" landing route — the authenticated "/" placeholder. Renders
 * the shared, i18n-driven empty state like every other nav destination this
 * phase; the real "Aujourd'hui" dashboard is Phase 4 (OPS-01) scope.
 */
export const Route = createFileRoute("/_authenticated/")({
  component: EmptyState,
});
