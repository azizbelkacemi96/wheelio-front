/**
 * DTO mirroring wheelio-api's GET /dashboard aggregate (computed in one SQL
 * query, org-scoped, Africa/Algiers windows). Amounts are in cents.
 */
export interface DashboardResponse {
  vehicles: {
    total: number;
    available: number;
    rented: number;
    maintenance: number;
  };
  contracts: {
    active: number;
    reserved: number;
  };
  today: {
    pickups: number;
    returns: number;
  };
  revenue_month_ttc_cents: number;
  deposits_held_cents: number;
  expiring_documents: number;
  utilization_pct: number;
  /** Initial-setup state, used to drive the onboarding checklist. */
  setup: {
    has_fiscal_identity: boolean;
    agencies: number;
    vehicles: number;
    customers: number;
  };
}
