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

/**
 * Route path params (`Route.useParams().customerId` et al.) reach these
 * functions as raw, user-controlled strings — address-bar editable, with no
 * format guarantee. `encodeURIComponent` each id before it is interpolated
 * into a request path so a crafted id (e.g. containing `/` or `../`
 * segments) is percent-encoded into a single opaque path segment and can
 * never be resolved by the URL parser as a path-traversal or extra segment
 * (review WR-03). This is a defense-in-depth input-validation guard, not a
 * tenant-isolation boundary — the backend's own authorization/RLS still
 * gates the actual response regardless of what path the request resolves
 * to. Real ids (UUIDs, and every id used by this module's test fixtures)
 * round-trip through `encodeURIComponent` unchanged.
 */
function encodeIdSegment(id: string): string {
  return encodeURIComponent(id);
}

export function fetchCustomers(q: string): Promise<CustomerResponse[]> {
  const searchParams = new URLSearchParams();
  if (q.trim() !== "") searchParams.set("q", q.trim());
  return api.get("customers", { searchParams }).json<CustomerResponse[]>();
}

export function fetchCustomer(id: string): Promise<CustomerResponse> {
  return api.get(`customers/${encodeIdSegment(id)}`).json<CustomerResponse>();
}

export function fetchCustomerDrivers(id: string): Promise<DriverResponse[]> {
  return api
    .get(`customers/${encodeIdSegment(id)}/drivers`)
    .json<DriverResponse[]>();
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
    .post(`customers/${encodeIdSegment(customerId)}/drivers`, { json: body })
    .json<DriverResponse>();
}
