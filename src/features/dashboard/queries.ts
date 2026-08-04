/**
 * Dashboard KPI query — one cheap org-scoped aggregate from GET /dashboard
 * (replaces the client-side fan-out for the figures). The today pickups/returns
 * LISTS still come from useTodayOverviewQuery (they need per-contract details).
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import type { DashboardResponse } from "@/types/dashboard";

export function useDashboardQuery() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get("dashboard").json<DashboardResponse>(),
  });
}
