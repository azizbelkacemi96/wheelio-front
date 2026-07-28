/**
 * Rental-contract HTTP calls — thin functions over the shared `api` ky client
 * (D-11). No second HTTP client is ever created here; every request inherits
 * the single-flight refresh interceptor and /v1 prefix from
 * src/shared/api/client.
 *
 * There is NO org/agency-wide "list all contracts" endpoint — the only list
 * route is per-vehicle (`listContractsByVehicle`). The contracts list and the
 * OPS-01 today overview are composed CLIENT-SIDE by fanning out over the
 * vehicles list (see queries.ts).
 */
import { api } from "@/shared/api/client";
import type {
  ActivateBody,
  CancelBody,
  CloseBody,
  ContractResponse,
  ContractStatus,
  CreateContractBody,
  DepositBody,
} from "@/types/rental";

/**
 * Route path params reach these functions as raw, user-controlled strings
 * (address-bar editable, no format guarantee). `encodeURIComponent` each id
 * before it is interpolated into a request path so a crafted id (e.g.
 * containing `/` or `../` segments) is percent-encoded into a single opaque
 * segment and can never be resolved as a path-traversal or extra segment
 * (threat T-04-02, mirrors customers/api.ts). Defense-in-depth only — the
 * backend's own authorization/RLS still gates the actual response. Real UUIDs
 * round-trip through `encodeURIComponent` unchanged.
 */
function encodeIdSegment(id: string): string {
  return encodeURIComponent(id);
}

export function createContract(
  vehicleId: string,
  body: CreateContractBody,
): Promise<ContractResponse> {
  return api
    .post(`vehicles/${encodeIdSegment(vehicleId)}/rental-contracts`, {
      json: body,
    })
    .json<ContractResponse>();
}

export function activateContract(
  contractId: string,
  body: ActivateBody,
): Promise<ContractResponse> {
  return api
    .post(`rental-contracts/${encodeIdSegment(contractId)}/activate`, {
      json: body,
    })
    .json<ContractResponse>();
}

export function closeContract(
  contractId: string,
  body: CloseBody,
): Promise<ContractResponse> {
  return api
    .post(`rental-contracts/${encodeIdSegment(contractId)}/close`, {
      json: body,
    })
    .json<ContractResponse>();
}

export function cancelContract(
  contractId: string,
  body: CancelBody,
): Promise<ContractResponse> {
  return api
    .post(`rental-contracts/${encodeIdSegment(contractId)}/cancel`, {
      json: body,
    })
    .json<ContractResponse>();
}

export function recordDeposit(
  contractId: string,
  body: DepositBody,
): Promise<ContractResponse> {
  return api
    .post(`rental-contracts/${encodeIdSegment(contractId)}/deposit`, {
      json: body,
    })
    .json<ContractResponse>();
}

export function getContract(contractId: string): Promise<ContractResponse> {
  return api
    .get(`rental-contracts/${encodeIdSegment(contractId)}`)
    .json<ContractResponse>();
}

export function listContractsByVehicle(
  vehicleId: string,
  status?: ContractStatus,
): Promise<ContractResponse[]> {
  // MSW matches path only; the handler reads searchParams itself (Pitfall 6).
  const searchParams = new URLSearchParams();
  if (status) searchParams.set("status", status);
  return api
    .get(`vehicles/${encodeIdSegment(vehicleId)}/rental-contracts`, {
      searchParams,
    })
    .json<ContractResponse[]>();
}
