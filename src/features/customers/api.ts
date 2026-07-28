/**
 * Customer HTTP calls — thin functions over the shared `api` ky client (D-06).
 * No second HTTP client is ever created here; every request inherits the
 * single-flight refresh interceptor and /v1 prefix from src/shared/api/client.
 *
 * Customers are org-scoped (no agency_id anywhere) — see queries.ts.
 */
import { api } from "@/shared/api/client";
import type {
  CreateCustomerBody,
  CreateDriverBody,
  CustomerResponse,
  DriverResponse,
} from "@/types/customer";

export function fetchCustomers(q: string): Promise<CustomerResponse[]> {
  const searchParams = new URLSearchParams();
  if (q.trim() !== "") searchParams.set("q", q.trim());
  return api.get("customers", { searchParams }).json<CustomerResponse[]>();
}

export function fetchCustomer(id: string): Promise<CustomerResponse> {
  return api.get(`customers/${id}`).json<CustomerResponse>();
}

export function fetchCustomerDrivers(id: string): Promise<DriverResponse[]> {
  return api.get(`customers/${id}/drivers`).json<DriverResponse[]>();
}

export function createCustomer(
  body: CreateCustomerBody,
): Promise<CustomerResponse> {
  return api.post("customers", { json: body }).json<CustomerResponse>();
}

export function createDriver(
  customerId: string,
  body: CreateDriverBody,
): Promise<DriverResponse> {
  return api
    .post(`customers/${customerId}/drivers`, { json: body })
    .json<DriverResponse>();
}
