/**
 * Inspection read layer — TanStack Query hooks over api.ts. Keys are
 * namespaced ["inspections", ...].
 *
 * NOTE (05-RESEARCH.md): there is NO "list inspections by contract" endpoint —
 * only create / get-by-id / damages / validate. The capture screen therefore
 * holds the freshly-created inspection in component state for the session; the
 * only read hooks are get-by-id and list-damages (used to reflect recorded
 * damages authoritatively).
 */
import { useQuery } from "@tanstack/react-query";
import { getInspection, listDamages } from "./api";

export function useInspectionQuery(inspectionId: string, enabled = true) {
  return useQuery({
    queryKey: ["inspections", "detail", inspectionId],
    queryFn: () => getInspection(inspectionId),
    enabled: enabled && inspectionId !== "",
  });
}

export function useDamagesQuery(inspectionId: string, enabled = true) {
  return useQuery({
    queryKey: ["inspections", "damages", inspectionId],
    queryFn: () => listDamages(inspectionId),
    enabled: enabled && inspectionId !== "",
  });
}
