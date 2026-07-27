import { createFileRoute } from "@tanstack/react-router";
import { VehicleDetail } from "@/features/fleet/VehicleDetail";

/**
 * /vehicules/$vehicleId — vehicle detail route (FLEET-02, D-04).
 *
 * No loader: component-level useQuery is the established idiom (the list route
 * follows the same shape). The id comes from the path param and is forwarded
 * to VehicleDetail, which composes useVehicleQuery + useActiveContractQuery.
 */
export const Route = createFileRoute("/_authenticated/vehicules/$vehicleId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { vehicleId } = Route.useParams();
  return <VehicleDetail vehicleId={vehicleId} />;
}
