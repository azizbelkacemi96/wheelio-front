/**
 * Literal TypeScript port of wheelio-api's RBAC scope model.
 *
 * Source of truth: wheelio-api `internal/domain/identity/scope.go` (Scope,
 * IsOrgAdmin, RoleInAgency, CanRead/CanOperate/CanManage, AtLeast rank
 * comparison). Any change to the rank order or admin-shortcut logic in that
 * Go file MUST be mirrored here — this is a read-only UX mirror, NOT an
 * independent security boundary; the backend re-enforces every mutation
 * independently regardless of what this module returns.
 *
 * Scope is built ONLY via `scopeFromMe`, fed exclusively by the `/me`
 * response (`MeResponse`). Nothing in this module (or anywhere else in the
 * client) decodes the JWT access token for role/permission data — the token
 * carries only `sub`/`org` claims, nothing to decode.
 */

import type { MeResponse } from "@/types/identity";

/** Organization-level role. owner/admin are implicit manager on every agency. */
export type OrgRole = "owner" | "admin" | "member";

/** Agency-level role. Rank: viewer(1) < agent(2) < manager(3). */
export type AgencyRole = "manager" | "agent" | "viewer";

/** Rank order mirroring scope.go's AgencyRole.AtLeast comparison. */
export const RANK: Record<AgencyRole, number> = { viewer: 1, agent: 2, manager: 3 };

/** Authorization context for the current user, resolved once from `/me`. */
export interface Scope {
  userId: string;
  orgId: string;
  orgRole: OrgRole;
  /** agencyId -> role, from `/me` memberships. */
  agencyRoles: Record<string, AgencyRole>;
}

/** Mirrors Scope.IsOrgAdmin — org admins (owner|admin) administer the whole org. */
export function isOrgAdmin(scope: Scope): boolean {
  return scope.orgRole === "owner" || scope.orgRole === "admin";
}

/**
 * Mirrors Scope.RoleInAgency — org admins are implicit manager everywhere,
 * regardless of any explicit membership; otherwise looks up the membership
 * role for the given agency (undefined if the user has no membership there).
 */
export function roleInAgency(scope: Scope, agencyId: string): AgencyRole | undefined {
  if (isOrgAdmin(scope)) return "manager";
  return scope.agencyRoles[agencyId];
}

/** Mirrors Scope.CanRead — viewer and above. */
export function canRead(scope: Scope, agencyId: string): boolean {
  return roleInAgency(scope, agencyId) !== undefined;
}

/** Mirrors Scope.CanOperate — agent and above (field operations). */
export function canOperate(scope: Scope, agencyId: string): boolean {
  const role = roleInAgency(scope, agencyId);
  return role !== undefined && RANK[role] >= RANK.agent;
}

/** Mirrors Scope.CanManage — manager only (agency management, deletions). */
export function canManage(scope: Scope, agencyId: string): boolean {
  const role = roleInAgency(scope, agencyId);
  return role !== undefined && RANK[role] >= RANK.manager;
}

/**
 * Builds a Scope from the `/me` response — the ONLY place this mapping
 * happens. Nothing else in the client should construct a Scope by hand.
 */
export function scopeFromMe(me: MeResponse): Scope {
  return {
    userId: me.user.id,
    orgId: me.organization.id,
    orgRole: me.user.org_role,
    agencyRoles: Object.fromEntries(
      me.memberships.map((m) => [m.agency_id, m.role]),
    ),
  };
}
