/**
 * Fleet data layer — TanStack Query hooks over the fleet api.ts functions.
 * Query keys are namespaced ["vehicles", ...] (D-06). The current agency
 * lives INSIDE the list key, so switching agencies refetches automatically
 * with no manual effect (Phase 1 success criterion 4 continuity).
 */
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/shared/auth/store";
import type { VehicleStatus } from "@/types/fleet";
import { fetchActiveContract, fetchVehicle, fetchVehicles } from "./api";

export function useVehiclesQuery(status: VehicleStatus | null) {
  // Permanently null for non-admins by design — do NOT gate the query on it.
  const agencyId = useAuthStore((s) => s.currentAgencyId);
  return useQuery({
    queryKey: ["vehicles", "list", { agencyId, status }],
    queryFn: () => fetchVehicles({ agencyId, status }),
  });
}

export function useVehicleQuery(vehicleId: string) {
  return useQuery({
    queryKey: ["vehicles", "detail", vehicleId],
    queryFn: () => fetchVehicle(vehicleId),
  });
}

export function useActiveContractQuery(vehicleId: string) {
  return useQuery({
    queryKey: ["vehicles", "detail", vehicleId, "active-contract"],
    queryFn: () => fetchActiveContract(vehicleId),
  });
}
