import { createFileRoute } from "@tanstack/react-router";
import { VehicleDetail } from "@/features/fleet/VehicleDetail";

/**
 * /vehicules/$vehicleId — vehicle detail route (FLEET-02, D-04). Now a
 * directory index so it can host the /modifier edit child (Phase 8).
 */
export const Route = createFileRoute("/_authenticated/vehicules/$vehicleId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { vehicleId } = Route.useParams();
  return <VehicleDetail vehicleId={vehicleId} />;
}
