import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/shared/ui/empty-state";

/**
 * /clients/$customerId — customer detail route (CUST-04, upcoming).
 *
 * STUB: this route exists so CustomerList's per-row display-name <Link> has
 * a registered, type-checked target (the whole project compiles under
 * `tsc -b`, so an unregistered route would fail typecheck) — mirrors the
 * `vehicules/$vehicleId` stub 02-02 added for the same reason. Plan 03-04
 * replaces this placeholder with the real CustomerDetail component.
 */
export const Route = createFileRoute("/_authenticated/clients/$customerId")({
  component: EmptyState,
});
