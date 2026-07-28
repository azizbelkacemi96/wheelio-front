/**
 * UUID -> name / plate / agency resolution for rental contracts.
 *
 * `contractResponse` carries ONLY `vehicle_id` + `customer_id` (UUIDs) — no
 * customer name, no vehicle plate, and crucially no `agency_id`
 * (04-RESEARCH.md backend reality #2). Every screen that shows a plate or a
 * customer name, and every action-gate that needs the vehicle's agency, joins
 * those here from the separately-fetched vehicles/customers lists. This is the
 * single home for that join so no screen re-reads `agency_id` off a contract
 * (an anti-pattern — it isn't there).
 */
import type { ContractResponse } from "@/types/rental";
import type { VehicleResponse } from "@/types/fleet";
import type { CustomerResponse } from "@/types/customer";

/** Build a Map keyed by `id` for O(1) lookups during a join. */
export function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

export interface ContractView {
  contract: ContractResponse;
  plate?: string;
  customerName?: string;
  agencyId?: string;
}

/** Company -> legal_name, individual -> full_name; undefined when neither. */
function resolveCustomerName(customer?: CustomerResponse): string | undefined {
  if (!customer) return undefined;
  return customer.legal_name ?? customer.full_name;
}

/**
 * Resolve a contract's display fields from the vehicle/customer lookup maps.
 * A missing vehicle or customer yields `undefined` for the affected field and
 * never throws — list/today views render partial rows rather than crashing.
 */
export function toContractView(
  contract: ContractResponse,
  vehicles: Map<string, VehicleResponse>,
  customers: Map<string, CustomerResponse>,
): ContractView {
  const vehicle = vehicles.get(contract.vehicle_id);
  const customer = customers.get(contract.customer_id);
  return {
    contract,
    plate: vehicle?.registration_plate,
    agencyId: vehicle?.agency_id,
    customerName: resolveCustomerName(customer),
  };
}
