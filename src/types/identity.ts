/**
 * DTOs mirroring wheelio-api's HTTP contract 1:1.
 *
 * Source of truth: wheelio-api `internal/adapter/httpapi/dto.go` (response
 * shapes + json tags) and `internal/domain/identity/roles.go` (OrgRole /
 * AgencyRole enum values). Any change to those Go types must be mirrored
 * here — this file is a read-only reflection of the backend contract, never
 * an independent source of truth.
 */

/** Organization-level role. owner/admin are implicit manager on every agency. */
export type OrgRole = "owner" | "admin" | "member";

/** Agency-level role. Rank: viewer(1) < agent(2) < manager(3). */
export type AgencyRole = "manager" | "agent" | "viewer";

export interface UserResponse {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  org_role: OrgRole;
  is_active: boolean;
  created_at: string; // ISO 8601
}

export interface OrganizationResponse {
  id: string;
  name: string;
  created_at: string; // ISO 8601
}

export interface AgencyResponse {
  id: string;
  name: string;
  address_line?: string;
  city?: string;
  postal_code?: string;
  country_code: string;
  phone?: string;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}

export interface MembershipResponse {
  user_id: string;
  agency_id: string;
  role: AgencyRole;
  created_at: string; // ISO 8601
}

export interface MeResponse {
  user: UserResponse;
  organization: OrganizationResponse;
  memberships: MembershipResponse[];
}

export interface AuthResponse {
  token_type: "Bearer";
  access_token: string;
  access_token_expires_at: string; // ISO 8601
  refresh_token: string;
  user: UserResponse;
  organization: OrganizationResponse;
}
