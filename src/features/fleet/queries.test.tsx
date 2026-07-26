/**
 * Hook-level behavior tests for the fleet data layer (02-01), driven through
 * MSW + a fresh QueryClient per test:
 * - useVehiclesQuery sends agency_id ONLY when the store's currentAgencyId
 *   is non-null (org admin), carries ?status when given, and keys the cache
 *   on ["vehicles", "list", { agencyId, status }] so agency switches and
 *   status filters refetch automatically;
 * - useVehicleQuery fetches vehicles/{id} under ["vehicles", "detail", id];
 * - useActiveContractQuery always asks the contracts endpoint with
 *   status=active and resolves to contracts[0] ?? null — never undefined
 *   (react-query rejects undefined data).
 */
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { server } from "@/test/mocks/server";
import { useAuthStore } from "@/shared/auth/store";
import { ownerFixture } from "@/test/fixtures/scope";
import {
  activeContractFixture,
  vehicleAvailable,
  vehicleFixtures,
  vehicleRented,
} from "@/test/fixtures/fleet";
import {
  useActiveContractQuery,
  useVehicleQuery,
  useVehiclesQuery,
} from "./queries";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080/v1";

const AGENCY_ALGER_ID = ownerFixture.agencies[0].id;

function resetAuthStore() {
  useAuthStore.setState({
    accessToken: null,
    accessTokenExpiresAt: null,
    refreshToken: null,
    scope: null,
    user: null,
    agencies: [],
    currentAgencyId: null,
  });
  localStorage.clear();
}

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  resetAuthStore();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
});

afterEach(() => {
  queryClient.clear();
  resetAuthStore();
});

describe("useVehiclesQuery", () => {
  it("sends agency_id={currentAgencyId} when the store has a current agency (org admin)", async () => {
    useAuthStore.setState({ currentAgencyId: AGENCY_ALGER_ID });

    let capturedUrl: URL | null = null;
    server.use(
      http.get(`${API_URL}/vehicles`, ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json([]);
      }),
    );

    const { result } = renderHook(() => useVehiclesQuery(null), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedUrl).not.toBeNull();
    expect(capturedUrl!.searchParams.get("agency_id")).toBe(AGENCY_ALGER_ID);
    expect(capturedUrl!.searchParams.has("status")).toBe(false);
  });

  it("sends NO agency_id when currentAgencyId is null (non-admin)", async () => {
    let capturedUrl: URL | null = null;
    server.use(
      http.get(`${API_URL}/vehicles`, ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json([]);
      }),
    );

    const { result } = renderHook(() => useVehiclesQuery(null), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedUrl).not.toBeNull();
    expect(capturedUrl!.searchParams.has("agency_id")).toBe(false);
  });

  it("carries status={value} when a status argument is given", async () => {
    let capturedUrl: URL | null = null;
    server.use(
      http.get(`${API_URL}/vehicles`, ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json([]);
      }),
    );

    const { result } = renderHook(() => useVehiclesQuery("rented"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedUrl!.searchParams.get("status")).toBe("rented");
  });

  it('keys the cache on ["vehicles", "list", { agencyId, status }]', async () => {
    useAuthStore.setState({ currentAgencyId: AGENCY_ALGER_ID });

    const { result } = renderHook(() => useVehiclesQuery("rented"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(
      queryClient.getQueryData([
        "vehicles",
        "list",
        { agencyId: AGENCY_ALGER_ID, status: "rented" },
      ]),
    ).toBeDefined();
  });

  it("resolves the full fixture list from the default MSW handler", async () => {
    const { result } = renderHook(() => useVehiclesQuery(null), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(vehicleFixtures.length);
  });
});

describe("useVehicleQuery", () => {
  it('fetches vehicles/{id} under key ["vehicles", "detail", id]', async () => {
    const { result } = renderHook(() => useVehicleQuery(vehicleAvailable.id), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(vehicleAvailable);
    expect(
      queryClient.getQueryData(["vehicles", "detail", vehicleAvailable.id]),
    ).toEqual(vehicleAvailable);
  });
});

describe("useActiveContractQuery", () => {
  it("requests vehicles/{id}/rental-contracts with status=active and resolves the first contract", async () => {
    let capturedUrl: URL | null = null;
    server.use(
      http.get(
        `${API_URL}/vehicles/:vehicleId/rental-contracts`,
        ({ request }) => {
          capturedUrl = new URL(request.url);
          return HttpResponse.json([activeContractFixture]);
        },
      ),
    );

    const { result } = renderHook(
      () => useActiveContractQuery(vehicleRented.id),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedUrl!.searchParams.get("status")).toBe("active");
    expect(result.current.data).toEqual(activeContractFixture);
  });

  it("resolves to null — never undefined — on an empty contracts array", async () => {
    const { result } = renderHook(
      () => useActiveContractQuery(vehicleAvailable.id),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeNull();
    expect(result.current.data).not.toBeUndefined();
  });
});
