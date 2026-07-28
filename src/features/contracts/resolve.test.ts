import { describe, expect, it } from "vitest";
import { byId, toContractView } from "./resolve";
import {
  vehicleAvailable,
  vehicleFixtures,
} from "@/test/fixtures/fleet";
import {
  customerCompany,
  customerFixtures,
  customerIndividualCin,
} from "@/test/fixtures/customers";
import { reservedContract } from "@/test/fixtures/contracts";
import type { ContractResponse } from "@/types/rental";

describe("byId", () => {
  it("builds a Map keyed by id", () => {
    const map = byId([{ id: "a" }, { id: "b" }]);
    expect(map.get("a")).toEqual({ id: "a" });
    expect(map.get("b")).toEqual({ id: "b" });
    expect(map.size).toBe(2);
  });
});

describe("toContractView", () => {
  const vehicles = byId(vehicleFixtures);
  const customers = byId(customerFixtures);

  it("resolves plate + agencyId from the vehicle and individual full_name as customerName", () => {
    const view = toContractView(reservedContract, vehicles, customers);
    expect(view.plate).toBe(vehicleAvailable.registration_plate);
    expect(view.agencyId).toBe(vehicleAvailable.agency_id);
    expect(view.customerName).toBe(customerIndividualCin.full_name);
    expect(view.contract).toBe(reservedContract);
  });

  it("prefers a company's legal_name for customerName", () => {
    const companyContract: ContractResponse = {
      ...reservedContract,
      customer_id: customerCompany.id,
    };
    const view = toContractView(companyContract, vehicles, customers);
    expect(view.customerName).toBe(customerCompany.legal_name);
  });

  it("yields undefined plate/customerName/agencyId (never throws) when the join misses", () => {
    const orphan: ContractResponse = {
      ...reservedContract,
      vehicle_id: "missing-vehicle",
      customer_id: "missing-customer",
    };
    const view = toContractView(orphan, vehicles, customers);
    expect(view.plate).toBeUndefined();
    expect(view.customerName).toBeUndefined();
    expect(view.agencyId).toBeUndefined();
  });
});
