/**
 * Document read layer — keys namespaced ["documents", ...].
 */
import { useQuery } from "@tanstack/react-query";
import { listExpiringDocuments, listVehicleDocuments } from "./api";

export function useVehicleDocumentsQuery(vehicleId: string, enabled = true) {
  return useQuery({
    queryKey: ["documents", "byVehicle", vehicleId],
    queryFn: () => listVehicleDocuments(vehicleId),
    enabled: enabled && vehicleId !== "",
  });
}

export function useExpiringDocumentsQuery(withinDays = 30) {
  return useQuery({
    queryKey: ["documents", "expiring", withinDays],
    queryFn: () => listExpiringDocuments(withinDays),
  });
}
