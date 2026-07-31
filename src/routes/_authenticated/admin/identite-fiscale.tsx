import { createFileRoute } from "@tanstack/react-router";
import { FiscalIdentityForm } from "@/features/billing/FiscalIdentityForm";

/**
 * "Identité fiscale société" (BILL-01) — owner-only admin section (D-09). The
 * company fiscal identity (décret 05-468 mentions) is the legal header of every
 * invoice; the form re-enforces the mandatory fields the backend gates invoice
 * issuance on. Replaces the 01-07 EmptyState placeholder.
 */
export const Route = createFileRoute("/_authenticated/admin/identite-fiscale")({
  component: FiscalIdentityForm,
});
