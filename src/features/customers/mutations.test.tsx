/**
 * Behavior tests for the create-then-attach mutation (03-03-PLAN.md Task 2
 * behavior block) — driven through MSW + a fresh QueryClient per test.
 */
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { server } from "@/test/mocks/server";
import type { CreateDriverBody, CustomerResponse } from "@/types/customer";
import type { CustomerFormValues } from "./schemas";
import {
  useAttachDriversMutation,
  useCreateCustomerMutation,
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

const individualValues: CustomerFormValues = {
  type: "individual",
  full_name: "Yacine Belkacem",
  identity_doc_type: "cin",
  identity_doc_number: "123456789012",
};

function companyValues(drivers: CustomerFormValues["drivers"] = []): CustomerFormValues {
  return {
    type: "company",
    legal_name: "SARL Transport Hamdi",
    rc: "16/00-1234567 B 21",
    drivers,
  };
}

function driverRow(name: string, license: string) {
  return { full_name: name, license_number: license };
}

describe("useCreateCustomerMutation", () => {
  it("individual: calls POST /customers once, no driver POST, resolves with the created customer", async () => {
    let customerPosts = 0;
    let driverPosts = 0;
    server.use(
      http.post(`${API_URL}/customers`, async ({ request }) => {
        customerPosts += 1;
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json<CustomerResponse>(
          { ...body, id: "new-customer-1", created_at: "now", updated_at: "now" } as CustomerResponse,
          { status: 201 },
        );
      }),
      http.post(`${API_URL}/customers/:customerId/drivers`, () => {
        driverPosts += 1;
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    const { result } = renderHook(() => useCreateCustomerMutation(), { wrapper });
    const outcome = await result.current.mutateAsync(individualValues);

    expect(customerPosts).toBe(1);
    expect(driverPosts).toBe(0);
    expect(outcome.customer.id).toBe("new-customer-1");
    expect(outcome.driverResults).toEqual([]);
  });

  it("company + zero drivers: POST /customers once, NO driver POST attempted, resolves success", async () => {
    let customerPosts = 0;
    let driverPosts = 0;
    server.use(
      http.post(`${API_URL}/customers`, async ({ request }) => {
        customerPosts += 1;
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json<CustomerResponse>(
          { ...body, id: "new-company-1", created_at: "now", updated_at: "now" } as CustomerResponse,
          { status: 201 },
        );
      }),
      http.post(`${API_URL}/customers/:customerId/drivers`, () => {
        driverPosts += 1;
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    const { result } = renderHook(() => useCreateCustomerMutation(), { wrapper });
    const outcome = await result.current.mutateAsync(companyValues([]));

    expect(customerPosts).toBe(1);
    expect(driverPosts).toBe(0);
    expect(outcome.driverResults).toEqual([]);
  });

  it("company + N drivers, all 201: POST /customers then N sequential driver POSTs IN ORDER, all succeeded", async () => {
    const seenNames: string[] = [];
    server.use(
      http.post(`${API_URL}/customers`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json<CustomerResponse>(
          { ...body, id: "new-company-2", created_at: "now", updated_at: "now" } as CustomerResponse,
          { status: 201 },
        );
      }),
      http.post(`${API_URL}/customers/:customerId/drivers`, async ({ request, params }) => {
        expect(params.customerId).toBe("new-company-2");
        const body = (await request.json()) as CreateDriverBody;
        seenNames.push(body.full_name);
        return HttpResponse.json({ ...body, id: `d-${seenNames.length}` }, { status: 201 });
      }),
    );

    const drivers = [
      driverRow("Karim Hamdi", "AL-2018-009911"),
      driverRow("Nadia Hamdi", "AL-2020-002233"),
    ];
    const { result } = renderHook(() => useCreateCustomerMutation(), { wrapper });
    const outcome = await result.current.mutateAsync(companyValues(drivers));

    expect(seenNames).toEqual(["Karim Hamdi", "Nadia Hamdi"]);
    expect(outcome.driverResults).toHaveLength(2);
    expect(outcome.driverResults.every((r) => r.success)).toBe(true);
  });

  it("company + N drivers where the 2nd driver POST 400s: customer created (not rolled back), row 0 succeeded, row 1 reported failed", async () => {
    let driverCallCount = 0;
    server.use(
      http.post(`${API_URL}/customers`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json<CustomerResponse>(
          { ...body, id: "new-company-3", created_at: "now", updated_at: "now" } as CustomerResponse,
          { status: 201 },
        );
      }),
      http.post(`${API_URL}/customers/:customerId/drivers`, async ({ request }) => {
        driverCallCount += 1;
        if (driverCallCount === 2) {
          return HttpResponse.json({ message: "invalid driver" }, { status: 400 });
        }
        const body = (await request.json()) as CreateDriverBody;
        return HttpResponse.json({ ...body, id: `d-${driverCallCount}` }, { status: 201 });
      }),
    );

    const drivers = [
      driverRow("Karim Hamdi", "AL-2018-009911"),
      driverRow("Nadia Hamdi", "AL-2020-002233"),
    ];
    const { result } = renderHook(() => useCreateCustomerMutation(), { wrapper });
    const outcome = await result.current.mutateAsync(companyValues(drivers));

    expect(outcome.customer.id).toBe("new-company-3");
    expect(outcome.driverResults[0]).toMatchObject({ index: 0, success: true });
    expect(outcome.driverResults[1]).toMatchObject({ index: 1, success: false });
  });

  it("does NOT invalidate ['customers'] on a partial failure", async () => {
    server.use(
      http.post(`${API_URL}/customers`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json<CustomerResponse>(
          { ...body, id: "new-company-4", created_at: "now", updated_at: "now" } as CustomerResponse,
          { status: 201 },
        );
      }),
      http.post(`${API_URL}/customers/:customerId/drivers`, () =>
        HttpResponse.json({ message: "invalid driver" }, { status: 400 }),
      ),
    );

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCreateCustomerMutation(), { wrapper });
    await result.current.mutateAsync(companyValues([driverRow("Karim Hamdi", "AL-2018-009911")]));

    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ["customers"] });
  });

  it("invalidates ['customers'] on full success", async () => {
    server.use(
      http.post(`${API_URL}/customers`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json<CustomerResponse>(
          { ...body, id: "new-individual-2", created_at: "now", updated_at: "now" } as CustomerResponse,
          { status: 201 },
        );
      }),
    );

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCreateCustomerMutation(), { wrapper });
    await result.current.mutateAsync(individualValues);

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["customers"] }),
    );
  });
});

describe("useAttachDriversMutation (retry failed rows)", () => {
  it("retries only the given driver bodies against the existing customer id and succeeds, WITHOUT any POST /customers", async () => {
    let customerPosts = 0;
    let driverPosts = 0;
    server.use(
      http.post(`${API_URL}/customers`, () => {
        customerPosts += 1;
        return HttpResponse.json({}, { status: 201 });
      }),
      http.post(`${API_URL}/customers/:customerId/drivers`, async ({ request, params }) => {
        driverPosts += 1;
        expect(params.customerId).toBe("existing-company-1");
        const body = (await request.json()) as CreateDriverBody;
        return HttpResponse.json({ ...body, id: "d-retry" }, { status: 201 });
      }),
    );

    const { result } = renderHook(() => useAttachDriversMutation(), { wrapper });
    const results = await result.current.mutateAsync({
      customerId: "existing-company-1",
      drivers: [{ full_name: "Nadia Hamdi", license_number: "AL-2020-002233" }],
    });

    expect(customerPosts).toBe(0);
    expect(driverPosts).toBe(1);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      index: 0,
      success: true,
      body: { full_name: "Nadia Hamdi", license_number: "AL-2020-002233" },
    });
  });

  it("invalidates ['customers'] once the retried rows all succeed", async () => {
    server.use(
      http.post(`${API_URL}/customers/:customerId/drivers`, async ({ request }) => {
        const body = (await request.json()) as CreateDriverBody;
        return HttpResponse.json({ ...body, id: "d-retry" }, { status: 201 });
      }),
    );

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useAttachDriversMutation(), { wrapper });
    await result.current.mutateAsync({
      customerId: "existing-company-1",
      drivers: [{ full_name: "Nadia Hamdi", license_number: "AL-2020-002233" }],
    });

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["customers"] }),
    );
  });
});
