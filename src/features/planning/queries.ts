/**
 * Planning read layer — one query over GET /planning for a [from, to) window
 * (dates as YYYY-MM-DD). Keyed by the window so week/month navigation refetches.
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import type { PlanningResponse } from "@/types/planning";

export function usePlanningQuery(from: string, to: string) {
  return useQuery({
    queryKey: ["planning", from, to],
    queryFn: () =>
      api.get(`planning?from=${from}&to=${to}`).json<PlanningResponse>(),
    enabled: from !== "" && to !== "",
  });
}
