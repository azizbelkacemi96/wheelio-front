import { createFileRoute } from "@tanstack/react-router";
import { UsersAdmin } from "@/features/admin/UsersAdmin";

/**
 * "Utilisateurs" (Phase 9) — org-admin only. List + create org users. The
 * component re-checks isOrgAdmin; the backend re-enforces.
 */
export const Route = createFileRoute("/_authenticated/admin/utilisateurs")({
  component: UsersAdmin,
});
