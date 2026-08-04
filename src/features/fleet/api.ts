/**
 * Fleet HTTP calls — thin functions over the shared `api` ky client (D-06).
 * No second HTTP client is ever created here; every request inherits the
 * single-flight refresh interceptor and /v1 prefix from src/shared/api/client.
 *
 * The current contract is ALWAYS resolved by asking the contracts endpoint
 * with status=active (never inferred from vehicle.status): the backend has no
 * joined "current contract" field, and vehicle.status is a separate axis.
 */
import { api } from "@/shared/api/client";
import type {
  ChangeStatusBody,
  CreateVehicleBody,
  LogMileageBody,
  MileageLogResponse,
  UpdateVehicleBody,
  VehicleResponse,
  VehicleStatus,
} from "@/types/fleet";
import type { ContractResponse } from "@/types/rental";

export interface FetchVehiclesParams {
  agencyId: string | null;
  status: VehicleStatus | null;
}

export function fetchVehicles({
  agencyId,
  status,
}: FetchVehiclesParams): Promise<VehicleResponse[]> {
  const searchParams = new URLSearchParams();
  // agency_id only for org admins (currentAgencyId non-null); non-admins get
  // their membership-scoped list from the backend with no param (Pitfall 5).
  if (agencyId !== null) searchParams.set("agency_id", agencyId);
  if (status !== null) searchParams.set("status", status);
  return api.get("vehicles", { searchParams }).json<VehicleResponse[]>();
}

export function fetchVehicle(vehicleId: string): Promise<VehicleResponse> {
  return api.get(`vehicles/${vehicleId}`).json<VehicleResponse>();
}

export async function fetchActiveContract(
  vehicleId: string,
): Promise<ContractResponse | null> {
  const contracts = await api
    .get(`vehicles/${vehicleId}/rental-contracts`, {
      searchParams: { status: "active" },
    })
    .json<ContractResponse[]>();
  // null, never undefined — react-query rejects undefined query data.
  return contracts[0] ?? null;
}

function encodeIdSegment(id: string): string {
  return encodeURIComponent(id);
}

export function createVehicle(body: CreateVehicleBody): Promise<VehicleResponse> {
  return api.post("vehicles", { json: body }).json<VehicleResponse>();
}

export function updateVehicle(
  vehicleId: string,
  body: UpdateVehicleBody,
): Promise<VehicleResponse> {
  return api
    .patch(`vehicles/${encodeIdSegment(vehicleId)}`, { json: body })
    .json<VehicleResponse>();
}

export function changeVehicleStatus(
  vehicleId: string,
  body: ChangeStatusBody,
): Promise<VehicleResponse> {
  return api
    .patch(`vehicles/${encodeIdSegment(vehicleId)}/status`, { json: body })
    .json<VehicleResponse>();
}

export function archiveVehicle(vehicleId: string): Promise<void> {
  return api.delete(`vehicles/${encodeIdSegment(vehicleId)}`).then(() => undefined);
}

export function logMileage(
  vehicleId: string,
  body: LogMileageBody,
): Promise<MileageLogResponse> {
  return api
    .post(`vehicles/${encodeIdSegment(vehicleId)}/mileage`, { json: body })
    .json<MileageLogResponse>();
}

export function listMileage(vehicleId: string): Promise<MileageLogResponse[]> {
  return api
    .get(`vehicles/${encodeIdSegment(vehicleId)}/mileage`)
    .json<MileageLogResponse[]>();
}
