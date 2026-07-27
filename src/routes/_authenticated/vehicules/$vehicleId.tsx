import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/shared/ui/empty-state";

/**
 * /vehicules/$vehicleId — vehicle detail route (FLEET-02).
 *
 * STUB: this route exists so the vehicle list's per-row plate <Link> has a
 * registered, type-checked target (the whole project compiles under
 * `tsc -b`, so an unregistered route would fail typecheck). Plan 02-03
 * replaces this placeholder with the real VehicleDetail component + its
 * useVehicleQuery/useActiveContractQuery composition.
 */
export const Route = createFileRoute("/_authenticated/vehicules/$vehicleId")({
  component: EmptyState,
});
