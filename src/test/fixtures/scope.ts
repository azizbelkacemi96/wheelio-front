import type {
  AgencyResponse,
  MeResponse,
  MembershipResponse,
} from "@/types/identity";

/**
 * Ready-made `/me` response fixtures per role, reusable by `permissions.ts`
 * tests (later plan) and by AppShell/nav component tests in this phase.
 * Role ranks per wheelio-api `roles.go`: viewer(1) < agent(2) < manager(3);
 * org admins (owner/admin) are implicit manager on every agency
 * (`Scope.RoleInAgency`) — see 01-RESEARCH.md Pattern 2.
 */

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const AGENCY_ALGER_ID = "22222222-2222-4222-8222-222222222222";
const AGENCY_ORAN_ID = "33333333-3333-4333-8333-333333333333";

const now = "2026-01-01T00:00:00.000Z";

const organization = {
  id: ORG_ID,
  name: "Wheelio Location Alger",
  created_at: now,
};

const agencyAlger: AgencyResponse = {
  id: AGENCY_ALGER_ID,
  name: "Agence Alger Centre",
  address_line: "12 Rue Didouche Mourad",
  city: "Alger",
  postal_code: "16000",
  country_code: "DZ",
  phone: "+213211234567",
  created_at: now,
  updated_at: now,
};

const agencyOran: AgencyResponse = {
  id: AGENCY_ORAN_ID,
  name: "Agence Oran Front de Mer",
  address_line: "5 Boulevard Front de Mer",
  city: "Oran",
  postal_code: "31000",
  country_code: "DZ",
  phone: "+213411234567",
  created_at: now,
  updated_at: now,
};

export interface RoleFixture {
  me: MeResponse;
  /** Agencies visible to this user — populated for owner-only switcher tests. */
  agencies: AgencyResponse[];
}

/** Agent de guichet: single agency, lowest operational rank above viewer. */
export const agentFixture: RoleFixture = {
  me: {
    user: {
      id: "44444444-4444-4444-8444-444444444444",
      email: "agent.alger@wheelio.dz",
      first_name: "Yacine",
      last_name: "Benali",
      org_role: "member",
      is_active: true,
      created_at: now,
    },
    organization,
    memberships: [
      {
        user_id: "44444444-4444-4444-8444-444444444444",
        agency_id: AGENCY_ALGER_ID,
        role: "agent",
        created_at: now,
      } satisfies MembershipResponse,
    ],
  },
  agencies: [agencyAlger],
};

/** Gérant d'agence: manager rank on a single agency. */
export const managerFixture: RoleFixture = {
  me: {
    user: {
      id: "55555555-5555-4555-8555-555555555555",
      email: "gerant.alger@wheelio.dz",
      first_name: "Amel",
      last_name: "Kaci",
      org_role: "member",
      is_active: true,
      created_at: now,
    },
    organization,
    memberships: [
      {
        user_id: "55555555-5555-4555-8555-555555555555",
        agency_id: AGENCY_ALGER_ID,
        role: "manager",
        created_at: now,
      } satisfies MembershipResponse,
    ],
  },
  agencies: [agencyAlger],
};

/**
 * Owner: org-level admin, implicit manager on every agency regardless of
 * explicit memberships (RoleInAgency org-admin shortcut) — multi-agency, for
 * the agency-switcher (D-10/D-11) tests.
 */
export const ownerFixture: RoleFixture = {
  me: {
    user: {
      id: "66666666-6666-4666-8666-666666666666",
      email: "owner@wheelio.dz",
      first_name: "Karim",
      last_name: "Haddad",
      org_role: "owner",
      is_active: true,
      created_at: now,
    },
    organization,
    memberships: [],
  },
  agencies: [agencyAlger, agencyOran],
};

export const allRoleFixtures = {
  agent: agentFixture,
  manager: managerFixture,
  owner: ownerFixture,
};
