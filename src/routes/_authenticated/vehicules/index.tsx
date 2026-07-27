import { createFileRoute } from "@tanstack/react-router";
import { VehicleList } from "@/features/fleet/VehicleList";

/**
 * /vehicules — the real fleet list screen (FLEET-01), replacing the Phase 1
 * placeholder. No loader: Phase 1 established component-level useQuery
 * (02-RESEARCH.md "Alternatives Considered") — VehicleList owns its own data
 * fetching via useVehiclesQuery.
 */
export const Route = createFileRoute("/_authenticated/vehicules/")({
  component: VehicleList,
});
