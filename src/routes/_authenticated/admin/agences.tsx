import { createFileRoute } from "@tanstack/react-router";
import { AgenciesAdmin } from "@/features/admin/AgenciesAdmin";

/**
 * "Gestion agences" (Phase 9) — org-admin only (D-09). Create/edit agencies +
 * manage members and roles. Replaces the 01-07 placeholder; the component
 * itself re-checks isOrgAdmin and the backend re-enforces every action.
 */
export const Route = createFileRoute("/_authenticated/admin/agences")({
  component: AgenciesAdmin,
});
