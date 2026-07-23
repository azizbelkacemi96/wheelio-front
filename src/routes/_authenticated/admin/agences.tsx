import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/shared/ui/empty-state";

/**
 * "Gestion agences" placeholder — owner-only admin section (D-09). Nav-gated
 * UX only; backend re-authorises real actions in later phases (T-01-rbac).
 */
export const Route = createFileRoute("/_authenticated/admin/agences")({
  component: EmptyState,
});
