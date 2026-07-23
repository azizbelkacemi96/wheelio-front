import { describe, expect, it } from "vitest";
import {
  agentFixture,
  managerFixture,
  ownerFixture,
} from "@/test/fixtures/scope";
import {
  canManage,
  canOperate,
  canRead,
  roleInAgency,
  scopeFromMe,
  type Scope,
} from "./permissions";

const AGENCY_ALGER_ID = "22222222-2222-4222-8222-222222222222";
const AGENCY_ORAN_ID = "33333333-3333-4333-8333-333333333333";
const UNRELATED_AGENCY_ID = "99999999-9999-4999-8999-999999999999";

describe("scopeFromMe", () => {
  it("maps MeResponse.user.org_role, organization.id, and memberships into a Scope", () => {
    const scope = scopeFromMe(agentFixture.me);

    expect(scope).toEqual<Scope>({
      userId: agentFixture.me.user.id,
      orgId: agentFixture.me.organization.id,
      orgRole: "member",
      agencyRoles: { [AGENCY_ALGER_ID]: "agent" },
    });
  });

  it("maps an owner's empty explicit memberships to an empty agencyRoles map", () => {
    const scope = scopeFromMe(ownerFixture.me);

    expect(scope.orgRole).toBe("owner");
    expect(scope.agencyRoles).toEqual({});
  });
});

describe("roleInAgency", () => {
  it("returns 'manager' for any agencyId when orgRole is owner (implicit manager everywhere)", () => {
    const scope = scopeFromMe(ownerFixture.me);

    expect(roleInAgency(scope, AGENCY_ALGER_ID)).toBe("manager");
    expect(roleInAgency(scope, AGENCY_ORAN_ID)).toBe("manager");
    // Even an agency the owner has no explicit membership row for at all.
    expect(roleInAgency(scope, UNRELATED_AGENCY_ID)).toBe("manager");
  });

  it("returns 'manager' for any agencyId when orgRole is admin", () => {
    const scope: Scope = {
      userId: "u1",
      orgId: "org1",
      orgRole: "admin",
      agencyRoles: {},
    };

    expect(roleInAgency(scope, UNRELATED_AGENCY_ID)).toBe("manager");
  });

  it("returns the membership role for a non-admin with a matching agency", () => {
    const agentScope = scopeFromMe(agentFixture.me);
    const managerScope = scopeFromMe(managerFixture.me);

    expect(roleInAgency(agentScope, AGENCY_ALGER_ID)).toBe("agent");
    expect(roleInAgency(managerScope, AGENCY_ALGER_ID)).toBe("manager");
  });

  it("returns undefined for an agency the non-admin user has no membership in", () => {
    const agentScope = scopeFromMe(agentFixture.me);

    expect(roleInAgency(agentScope, AGENCY_ORAN_ID)).toBeUndefined();
  });
});

describe("canRead / canOperate / canManage rank gates", () => {
  const AGENCY_ID = AGENCY_ALGER_ID;

  const viewerScope: Scope = {
    userId: "u-viewer",
    orgId: "org1",
    orgRole: "member",
    agencyRoles: { [AGENCY_ID]: "viewer" },
  };
  const agentScope: Scope = {
    userId: "u-agent",
    orgId: "org1",
    orgRole: "member",
    agencyRoles: { [AGENCY_ID]: "agent" },
  };
  const managerScope: Scope = {
    userId: "u-manager",
    orgId: "org1",
    orgRole: "member",
    agencyRoles: { [AGENCY_ID]: "manager" },
  };
  const noAccessScope: Scope = {
    userId: "u-none",
    orgId: "org1",
    orgRole: "member",
    agencyRoles: {},
  };

  it("canRead is true for viewer and above, false with no membership", () => {
    expect(canRead(viewerScope, AGENCY_ID)).toBe(true);
    expect(canRead(agentScope, AGENCY_ID)).toBe(true);
    expect(canRead(managerScope, AGENCY_ID)).toBe(true);
    expect(canRead(noAccessScope, AGENCY_ID)).toBe(false);
  });

  it("canOperate is true for agent and above, false for viewer", () => {
    expect(canOperate(viewerScope, AGENCY_ID)).toBe(false);
    expect(canOperate(agentScope, AGENCY_ID)).toBe(true);
    expect(canOperate(managerScope, AGENCY_ID)).toBe(true);
  });

  it("canManage is true for manager only", () => {
    expect(canManage(viewerScope, AGENCY_ID)).toBe(false);
    expect(canManage(agentScope, AGENCY_ID)).toBe(false);
    expect(canManage(managerScope, AGENCY_ID)).toBe(true);
  });

  it("org admins pass every rank gate on any agency via the implicit-manager shortcut", () => {
    const ownerScope = scopeFromMe(ownerFixture.me);

    expect(canRead(ownerScope, UNRELATED_AGENCY_ID)).toBe(true);
    expect(canOperate(ownerScope, UNRELATED_AGENCY_ID)).toBe(true);
    expect(canManage(ownerScope, UNRELATED_AGENCY_ID)).toBe(true);
  });

  it("never resolves prototype-chain keys as memberships — Go map semantics (WR-04)", () => {
    const memberScope = scopeFromMe(agentFixture.me);

    // A bare index lookup would walk Object.prototype and "find" a role for
    // these — a member must get undefined/false for any non-own key.
    for (const key of ["constructor", "toString", "hasOwnProperty", "__proto__"]) {
      expect(roleInAgency(memberScope, key)).toBeUndefined();
      expect(canRead(memberScope, key)).toBe(false);
      expect(canOperate(memberScope, key)).toBe(false);
      expect(canManage(memberScope, key)).toBe(false);
    }
  });
});

// Note: "no JWT-decode import" is verified structurally (this module's only
// import is `MeResponse` from src/types/identity.ts, and Scope is only ever
// constructed by scopeFromMe below) rather than via a source-text scan —
// this project has no @types/node, so node:fs/process are unavailable to
// test files without adding a new dependency purely for a static-analysis
// assertion (out of scope for this plan's file list).
