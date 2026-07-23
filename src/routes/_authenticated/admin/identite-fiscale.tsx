import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/shared/ui/empty-state";

/**
 * "Identité fiscale société" placeholder — owner-only admin section (D-09).
 * Reachable ONLY through the org-admin nav (never the base nav); visibility
 * gating is UX-only — the backend re-authorises any real action when these
 * features ship (T-01-rbac).
 */
export const Route = createFileRoute("/_authenticated/admin/identite-fiscale")({
  component: EmptyState,
});
