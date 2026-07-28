/**
 * Behavior tests for the contracts read layer (04-01-PLAN.md Task 2 behavior
 * block) — driven through MSW + a fresh QueryClient per test.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { vehicleAvailable, vehicleRented } from "@/test/fixtures/fleet";
import {
  reservedTodayContract,
  activeEndingTodayContract,
} from "@/test/fixtures/contracts";
import {
  useAllContractsQuery,
  useContractQuery,
  useContractsForVehicles,
  useTodayOverviewQuery,
} from "./queries";

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
});

afterEach(() => {
  queryClient.clear();
});

describe("useContractsForVehicles", () => {
  it("fans out one request per vehicle and flattens the combined data", async () => {
    const { result } = renderHook(
      () =>
        useContractsForVehicles(
          [vehicleAvailable.id, vehicleRented.id],
          "reserved",
        ),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.isError).toBe(false);
    // Every combined item is a reserved contract on one of the two vehicles.
    expect(result.current.data.length).toBeGreaterThan(0);
    expect(result.current.data.every((c) => c.status === "reserved")).toBe(true);
    const vehicleIds = new Set(result.current.data.map((c) => c.vehicle_id));
    for (const id of vehicleIds) {
      expect([vehicleAvailable.id, vehicleRented.id]).toContain(id);
    }
  });

  it("is not pending and not error for an empty vehicle-id list", async () => {
    const { result } = renderHook(
      () => useContractsForVehicles([], "reserved"),
      { wrapper },
    );
    expect(result.current.isPending).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toEqual([]);
  });
});

describe("useContractQuery", () => {
  it("reads a single contract by id", async () => {
    const { result } = renderHook(
      () => useContractQuery(reservedTodayContract.id),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe(reservedTodayContract.id);
  });
});

describe("useAllContractsQuery", () => {
  it("composes vehicles then fans out with no status filter and returns both", async () => {
    const { result } = renderHook(() => useAllContractsQuery(), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.isError).toBe(false);
    expect(result.current.vehicles.length).toBeGreaterThan(0);
    // The full fan-out surfaces contracts across all statuses.
    const statuses = new Set(result.current.contracts.map((c) => c.status));
    expect(statuses.size).toBeGreaterThan(1);
  });
});

describe("useTodayOverviewQuery", () => {
  it("returns pickups (reserved starting today) and returns (active ending today) in Algiers time", async () => {
    const { result } = renderHook(() => useTodayOverviewQuery(), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.isError).toBe(false);

    expect(
      result.current.pickups.some((c) => c.id === reservedTodayContract.id),
    ).toBe(true);
    expect(result.current.pickups.every((c) => c.status === "reserved")).toBe(
      true,
    );
    expect(
      result.current.returns.some((c) => c.id === activeEndingTodayContract.id),
    ).toBe(true);
    expect(result.current.returns.every((c) => c.status === "active")).toBe(
      true,
    );
  });
});
