/**
 * Org-admin HTTP calls (Phase 9): user management, agency CRUD, and agency
 * membership/roles. All are org-admin operations (backend re-enforces); the UI
 * gates on isOrgAdmin. Thin functions over the shared `api` ky client.
 */
import { api } from "@/shared/api/client";
import type {
  AgencyBody,
  AgencyResponse,
  CreateUserBody,
  MembershipResponse,
  SetMemberBody,
  UserResponse,
} from "@/types/identity";

function enc(id: string): string {
  return encodeURIComponent(id);
}

// ---- Users ----

export function listUsers(): Promise<UserResponse[]> {
  return api.get("users").json<UserResponse[]>();
}

export function createUser(body: CreateUserBody): Promise<UserResponse> {
  return api.post("users", { json: body }).json<UserResponse>();
}

// ---- Agencies ----

export function listAgencies(): Promise<AgencyResponse[]> {
  return api.get("agencies").json<AgencyResponse[]>();
}

export function createAgency(body: AgencyBody): Promise<AgencyResponse> {
  return api.post("agencies", { json: body }).json<AgencyResponse>();
}

export function updateAgency(agencyId: string, body: AgencyBody): Promise<AgencyResponse> {
  return api.patch(`agencies/${enc(agencyId)}`, { json: body }).json<AgencyResponse>();
}

// ---- Members ----

export function listMembers(agencyId: string): Promise<MembershipResponse[]> {
  return api.get(`agencies/${enc(agencyId)}/members`).json<MembershipResponse[]>();
}

export function setMember(
  agencyId: string,
  userId: string,
  body: SetMemberBody,
): Promise<MembershipResponse> {
  return api
    .put(`agencies/${enc(agencyId)}/members/${enc(userId)}`, { json: body })
    .json<MembershipResponse>();
}

export function removeMember(agencyId: string, userId: string): Promise<void> {
  return api
    .delete(`agencies/${enc(agencyId)}/members/${enc(userId)}`)
    .then(() => undefined);
}
