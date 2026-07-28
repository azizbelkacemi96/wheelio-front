/**
 * Hook-level behavior tests for the customer data layer (03-01), driven
 * through MSW + a fresh QueryClient per test, mirroring
 * src/features/fleet/queries.test.tsx:
 * - useCustomersQuery("") fetches GET /customers and resolves the full
 *   fixture slice, keyed ["customers","list",{ q: "" }];
 * - useCustomersQuery("<term>") sends ?q=<term> and resolves only matches;
 * - useCustomerQuery(id) fetches GET /customers/{id} under
 *   ["customers","detail",id];
 * - useCustomerDriversQuery(id) fetches GET /customers/{id}/drivers under
 *   ["customers","detail",id,"drivers"];
 * - NO request carries an agency_id param and NO key contains
 *   currentAgencyId, even when the auth store has one set — customers are
 *   org-scoped (D-07/D-08), unlike fleet's agency-keyed list.
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
  customerCompany,
  customerFixtures,
  driverHamdiA,
  driverHamdiB,
} from "@/test/fixtures/customers";
import {
  useCustomerDriversQuery,
  useCustomerQuery,
  useCustomersQuery,
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

describe("useCustomersQuery", () => {
  it('fetches GET /customers with no q param and resolves the full fixture slice, keyed ["customers","list",{ q: "" }]', async () => {
    let capturedUrl: URL | null = null;
    server.use(
      http.get(`${API_URL}/customers`, ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json(customerFixtures);
      }),
    );

    const { result } = renderHook(() => useCustomersQuery(""), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedUrl!.searchParams.has("q")).toBe(false);
    expect(result.current.data).toHaveLength(customerFixtures.length);
    expect(
      queryClient.getQueryData(["customers", "list", { q: "" }]),
    ).toBeDefined();
  });

  it("sends ?q=<term> and resolves only matching fixtures", async () => {
    let capturedUrl: URL | null = null;
    server.use(
      http.get(`${API_URL}/customers`, ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json([customerCompany]);
      }),
    );

    const { result } = renderHook(() => useCustomersQuery("Hamdi"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedUrl!.searchParams.get("q")).toBe("Hamdi");
    expect(result.current.data).toEqual([customerCompany]);
  });

  it("carries NO agency_id param and NO currentAgencyId in the query key, even when the store has one set", async () => {
    useAuthStore.setState({ currentAgencyId: AGENCY_ALGER_ID });

    let capturedUrl: URL | null = null;
    server.use(
      http.get(`${API_URL}/customers`, ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json(customerFixtures);
      }),
    );

    const { result } = renderHook(() => useCustomersQuery(""), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedUrl!.searchParams.has("agency_id")).toBe(false);
    expect(
      queryClient.getQueryData(["customers", "list", { q: "" }]),
    ).toBeDefined();
  });
});

describe("useCustomerQuery", () => {
  it('fetches GET /customers/{id} under key ["customers","detail",id]', async () => {
    const { result } = renderHook(
      () => useCustomerQuery(customerCompany.id),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(customerCompany);
    expect(
      queryClient.getQueryData(["customers", "detail", customerCompany.id]),
    ).toEqual(customerCompany);
  });
});

describe("useCustomerDriversQuery", () => {
  it('fetches GET /customers/{id}/drivers under key ["customers","detail",id,"drivers"]', async () => {
    const { result } = renderHook(
      () => useCustomerDriversQuery(customerCompany.id),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([driverHamdiA, driverHamdiB]);
    expect(
      queryClient.getQueryData([
        "customers",
        "detail",
        customerCompany.id,
        "drivers",
      ]),
    ).toEqual([driverHamdiA, driverHamdiB]);
  });
});
