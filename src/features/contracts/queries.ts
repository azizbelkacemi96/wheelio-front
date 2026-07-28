/**
 * Contracts read layer — TanStack Query hooks over the contracts api.ts
 * functions. Query keys are namespaced ["contracts", ...] (D-06), mirroring
 * fleet/queries.ts.
 *
 * There is NO list-all or /today endpoint. The contracts list AND the OPS-01
 * today overview are composed CLIENT-SIDE: read the vehicles list, then fan
 * out one per-vehicle rental-contracts request in parallel with `useQueries`
 * and combine the results (04-RESEARCH.md "OPS-01 fan-out with useQueries").
 * Never invent a GET /contracts or GET /today endpoint.
 */
import { useQueries, useQuery } from "@tanstack/react-query";
import type { VehicleResponse } from "@/types/fleet";
import type { ContractResponse, ContractStatus } from "@/types/rental";
import { useVehiclesQuery } from "@/features/fleet/queries";
import { getContract, listContractsByVehicle } from "./api";
import { isTodayAlgiers } from "./dateAlgiers";

export function useContractQuery(id: string) {
  return useQuery({
    queryKey: ["contracts", "detail", id],
    queryFn: () => getContract(id),
  });
}

export function useContractsByVehicleQuery(
  vehicleId: string,
  status?: ContractStatus,
) {
  return useQuery({
    queryKey: ["contracts", "byVehicle", vehicleId, { status }],
    queryFn: () => listContractsByVehicle(vehicleId, status),
  });
}

export interface CombinedContracts {
  data: ContractResponse[];
  isPending: boolean;
  isError: boolean;
}

/**
 * Parallel per-vehicle fan-out: one `listContractsByVehicle` call per id, its
 * combined `data` the flattened concatenation. `isPending` is true if ANY
 * child is pending, `isError` if any child errored. An empty id list yields
 * `{ data: [], isPending: false, isError: false }`.
 */
export function useContractsForVehicles(
  vehicleIds: string[],
  status: ContractStatus | null,
): CombinedContracts {
  return useQueries({
    queries: vehicleIds.map((id) => ({
      queryKey: ["contracts", "byVehicle", id, { status }],
      queryFn: () => listContractsByVehicle(id, status ?? undefined),
    })),
    combine: (results): CombinedContracts => ({
      data: results.flatMap((r) => r.data ?? []),
      isPending: results.some((r) => r.isPending),
      isError: results.some((r) => r.isError),
    }),
  });
}

export interface AllContracts {
  vehicles: VehicleResponse[];
  contracts: ContractResponse[];
  isPending: boolean;
  isError: boolean;
}

/**
 * The composed `/contrats` list source: read the vehicles list, fan out with
 * no status filter, and return the combined contracts PLUS the vehicles array
 * (the caller needs it for the id -> plate/agency join via resolve.ts).
 */
export function useAllContractsQuery(): AllContracts {
  const vehiclesQuery = useVehiclesQuery(null);
  const vehicles = vehiclesQuery.data ?? [];
  const combined = useContractsForVehicles(
    vehicles.map((v) => v.id),
    null,
  );
  return {
    vehicles,
    contracts: combined.data,
    isPending: vehiclesQuery.isPending || combined.isPending,
    isError: vehiclesQuery.isError || combined.isError,
  };
}

export interface TodayOverview {
  vehicles: VehicleResponse[];
  pickups: ContractResponse[];
  returns: ContractResponse[];
  isPending: boolean;
  isError: boolean;
}

/**
 * OPS-01: pickups are reserved contracts starting today (Africa/Algiers),
 * returns are active contracts ending today. Fans out reserved + active over
 * the vehicles and filters each by the Algiers day-key (never naive UTC).
 */
export function useTodayOverviewQuery(): TodayOverview {
  const vehiclesQuery = useVehiclesQuery(null);
  const vehicles = vehiclesQuery.data ?? [];
  const vehicleIds = vehicles.map((v) => v.id);

  const reserved = useContractsForVehicles(vehicleIds, "reserved");
  const active = useContractsForVehicles(vehicleIds, "active");

  return {
    vehicles,
    pickups: reserved.data.filter((c) => isTodayAlgiers(c.starts_at)),
    returns: active.data.filter((c) => isTodayAlgiers(c.ends_at)),
    isPending:
      vehiclesQuery.isPending || reserved.isPending || active.isPending,
    isError: vehiclesQuery.isError || reserved.isError || active.isError,
  };
}
