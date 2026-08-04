/**
 * Document mutations (Phase 8). Upload/delete invalidate the vehicle's document
 * list AND the org-wide expiring feed (a new insurance/CT changes what's due).
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteDocument, uploadDocument, type UploadDocumentInput } from "./api";

export function useUploadDocument(vehicleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UploadDocumentInput) => uploadDocument(vehicleId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", "byVehicle", vehicleId] });
      queryClient.invalidateQueries({ queryKey: ["documents", "expiring"] });
    },
  });
}

export function useDeleteDocument(vehicleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => deleteDocument(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", "byVehicle", vehicleId] });
      queryClient.invalidateQueries({ queryKey: ["documents", "expiring"] });
    },
  });
}
