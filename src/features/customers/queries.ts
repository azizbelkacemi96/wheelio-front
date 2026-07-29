/**
 * Customer data layer — TanStack Query hooks over the customers api.ts
 * functions. Query keys are namespaced ["customers", ...] (D-06).
 *
 * IMPORTANT CONTRAST WITH FLEET: customers are ORG-scoped, not
 * agency-scoped (D-07/D-08, research "Scoping & authorization"). The
 * backend's customer endpoints take NO `agency_id` param and run under
 * `tx.WithOrgScope`, never `tx.WithAgencyScope`. Do NOT read
 * `currentAgencyId` from the auth store here and do NOT add it to any
 * query key or request param — a future reader "fixing" this to mirror
 * fleet/queries.ts's agency-keyed list would be introducing a bug, not
 * a consistency improvement.
 *
 * The create-then-attach mutation (create customer, then sequentially
 * POST each driver) intentionally does NOT live here — it belongs to
 * 03-03's mutations.ts alongside the create form.
 */
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  fetchCustomer,
  fetchCustomerDrivers,
  fetchCustomers,
} from "./api";

/**
 * `placeholderData: keepPreviousData` keeps the previous search result set
 * (and `isSuccess`) visible while a new `?q=` request is in flight, instead
 * of resetting to `status: 'pending'` on every distinct debounced search
 * term. Without this, CustomerList's own "controls stay mounted" invariant
 * is defeated: `showControls`/`showCount` gate on `isPending`, which would
 * otherwise flip on nearly every keystroke-driven search and unmount the
 * very `<Input>` holding the user's search text (review CR-02).
 */
export function useCustomersQuery(q: string) {
  return useQuery({
    queryKey: ["customers", "list", { q }],
    queryFn: () => fetchCustomers(q),
    placeholderData: keepPreviousData,
  });
}

/**
 * `options.enabled` lets a dependent caller (e.g. ContractDetail, which only
 * knows the customer id AFTER the contract loads) gate this query on the parent
 * data instead of firing `fetchCustomer("")` on first render. Defaults to
 * enabled so existing callers (CustomerDetail) are unaffected.
 */
export function useCustomerQuery(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["customers", "detail", id],
    queryFn: () => fetchCustomer(id),
    enabled: options?.enabled ?? true,
  });
}

export function useCustomerDriversQuery(id: string) {
  return useQuery({
    queryKey: ["customers", "detail", id, "drivers"],
    queryFn: () => fetchCustomerDrivers(id),
  });
}
