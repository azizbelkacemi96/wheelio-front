/**
 * Behavior tests for the contracts lifecycle mutations (04-01-PLAN.md Task 3
 * behavior block) — MSW + a fresh QueryClient per test, spying on
 * queryClient.invalidateQueries exactly like customers/mutations.test.tsx.
 */
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { server } from "@/test/mocks/server";
import { vehicleRented } from "@/test/fixtures/fleet";
import { overlapVehicleId, reservedContract } from "@/test/fixtures/contracts";
import {
  activateContract,
  createContract,
} from "./api";
import {
  overlapErrorKey,
  transitionErrorKey,
  useActivate,
  useCancel,
  useClose,
  useCreateContract,
  useRecordDeposit,
} from "./mutations";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080/v1";

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
});

afterEach(() => {
  queryClient.clear();
});

async function capture(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    await fn();
    return null;
  } catch (error) {
    return error;
  }
}

const freeWindow = {
  customer_id: reservedContract.customer_id,
  starts_at: "2027-03-01T09:00:00.000Z",
  ends_at: "2027-03-05T09:00:00.000Z",
};

describe("useCreateContract", () => {
  it("POSTs create once and invalidates BOTH ['contracts'] and ['vehicles'] on success", async () => {
    let createPosts = 0;
    server.use(
      http.post(
        `${API_URL}/vehicles/:vehicleId/rental-contracts`,
        async ({ request }) => {
          createPosts += 1;
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(
            {
              ...body,
              id: "created-1",
              vehicle_id: vehicleRented.id,
              status: "reserved",
              created_at: "now",
              updated_at: "now",
            },
            { status: 201 },
          );
        },
      ),
    );

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCreateContract(), { wrapper });
    await result.current.mutateAsync({
      vehicleId: vehicleRented.id,
      body: freeWindow,
    });

    expect(createPosts).toBe(1);
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["contracts"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["vehicles"] });
    });
  });
});

describe("lifecycle mutations invalidate both namespaces", () => {
  it("useActivate invalidates ['contracts'] and ['vehicles']", async () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useActivate(reservedContract.id), {
      wrapper,
    });
    await result.current.mutateAsync({ mileage: 100, fuel: "full" });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["contracts"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["vehicles"] });
    });
  });

  it("useClose invalidates ['contracts'] and ['vehicles']", async () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useClose(reservedContract.id), {
      wrapper,
    });
    await result.current.mutateAsync({
      mileage: 200,
      fuel: "half",
      invoice_lines: [
        {
          description: "Location",
          quantity: 1,
          unit_price_ht_cents: 100000,
          vat_rate: 19,
        },
      ],
    });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["contracts"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["vehicles"] });
    });
  });

  it("useCancel invalidates ['contracts'] and ['vehicles']", async () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCancel(reservedContract.id), {
      wrapper,
    });
    await result.current.mutateAsync({ reason: "Client indisponible" });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["contracts"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["vehicles"] });
    });
  });

  it("useRecordDeposit invalidates ['contracts'] and ['vehicles']", async () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useRecordDeposit(reservedContract.id), {
      wrapper,
    });
    await result.current.mutateAsync({ amount_cents: 500000, method: "cash" });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["contracts"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["vehicles"] });
    });
  });
});

describe("overlapErrorKey", () => {
  it("maps a create-time 409 to the overlap key", async () => {
    const err = await capture(() =>
      createContract(overlapVehicleId, {
        customer_id: reservedContract.customer_id,
        // Intersects overlapReservedA's [10-10, 10-20] window -> 409.
        starts_at: "2026-10-12T09:00:00.000Z",
        ends_at: "2026-10-14T09:00:00.000Z",
      }),
    );
    expect(overlapErrorKey(err)).toBe("contracts.errors.overlap");
  });

  it("returns null for a non-HTTP error", () => {
    expect(overlapErrorKey(new Error("boom"))).toBeNull();
  });
});

describe("transitionErrorKey", () => {
  it("maps each kind's 409 to its distinct illegal-transition key", async () => {
    server.use(
      http.post(`${API_URL}/rental-contracts/:contractId/activate`, () =>
        HttpResponse.json({ detail: "illegal transition" }, { status: 409 }),
      ),
    );
    const err = await capture(() =>
      activateContract(reservedContract.id, { mileage: 1, fuel: "full" }),
    );

    expect(transitionErrorKey("activate", err)).toBe(
      "contracts.errors.notReservable",
    );
    expect(transitionErrorKey("close", err)).toBe(
      "contracts.errors.notClosable",
    );
    expect(transitionErrorKey("cancel", err)).toBe(
      "contracts.errors.notCancellable",
    );
  });

  it("returns null for a non-HTTP error", () => {
    expect(transitionErrorKey("activate", new Error("boom"))).toBeNull();
  });
});
