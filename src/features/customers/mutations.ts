/**
 * Create-then-attach mutation for CUST-01/CUST-02 (03-RESEARCH.md "The
 * individual/company + drivers create sequence").
 *
 * Drivers are NOT nested in the customer-create payload — they are a
 * separate endpoint (POST /customers/:id/drivers). Step 1 creates the
 * customer; step 2 (company branch only, when driver rows exist) iterates
 * them SEQUENTIALLY (`for … await`, never Promise.all) so a mid-list
 * failure has a clear "created customer + first N drivers" state and the
 * error points at a specific row index.
 *
 * Partial-failure contract: once step 1 returns 201 the customer is
 * PERSISTED — it is never rolled back (no transactional endpoint exists on
 * the backend). The mutation result always carries the created customer
 * plus a per-row DriverAttachResult so the caller can tell exactly which
 * drivers succeeded/failed and retry only the failed rows via
 * `useAttachDriversMutation` (customer is NOT recreated on retry).
 *
 * `queryClient.invalidateQueries(["customers"])` fires only once the whole
 * sequence (customer + every driver row) has fully succeeded — a partial
 * result deliberately does not invalidate yet, since the retry path may
 * still change driver attachment state for the same customer id.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateCustomerBody, CreateDriverBody, CustomerResponse } from "@/types/customer";
import { createCustomer, createDriver } from "./api";
import type { CustomerFormValues, DriverFormValues } from "./schemas";

/** Outcome of a single driver POST within the sequential attach loop. */
export interface DriverAttachResult {
  index: number;
  body: CreateDriverBody;
  success: boolean;
  error?: unknown;
}

export interface CreateCustomerResult {
  customer: CustomerResponse;
  driverResults: DriverAttachResult[];
}

/** Normalizes an optional form string to `undefined` when blank, so empty
 * date inputs never send `""` to the backend (which is not a valid
 * `datetime=2006-01-02` value). */
function normalize(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function toCreateCustomerBody(values: CustomerFormValues): CreateCustomerBody {
  if (values.type === "individual") {
    return {
      type: "individual",
      full_name: values.full_name,
      identity_doc_type: values.identity_doc_type,
      identity_doc_number: normalize(values.identity_doc_number),
      license_number: normalize(values.license_number),
      license_issued_at: normalize(values.license_issued_at) ?? null,
      license_valid_until: normalize(values.license_valid_until) ?? null,
      phone: normalize(values.phone),
      address: normalize(values.address),
    };
  }
  return {
    type: "company",
    legal_name: values.legal_name,
    rc: values.rc,
    nif: normalize(values.nif),
    nis: normalize(values.nis),
    license_number: normalize(values.license_number),
    license_issued_at: normalize(values.license_issued_at) ?? null,
    license_valid_until: normalize(values.license_valid_until) ?? null,
    phone: normalize(values.phone),
    address: normalize(values.address),
  };
}

export function toCreateDriverBody(driver: DriverFormValues): CreateDriverBody {
  return {
    full_name: driver.full_name,
    license_number: driver.license_number,
    license_issued_at: normalize(driver.license_issued_at) ?? null,
    license_valid_until: normalize(driver.license_valid_until) ?? null,
  };
}

/** Sequential (NOT Promise.all) create-then-attach loop, shared by the main
 * create mutation and the failed-rows retry mutation. */
async function attachDriversSequentially(
  customerId: string,
  drivers: CreateDriverBody[],
): Promise<DriverAttachResult[]> {
  const results: DriverAttachResult[] = [];
  for (let index = 0; index < drivers.length; index += 1) {
    const body = drivers[index];
    try {
      await createDriver(customerId, body);
      results.push({ index, body, success: true });
    } catch (error) {
      results.push({ index, body, success: false, error });
    }
  }
  return results;
}

export function isFullSuccess(result: CreateCustomerResult): boolean {
  return result.driverResults.every((r) => r.success);
}

export function useCreateCustomerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: CustomerFormValues): Promise<CreateCustomerResult> => {
      const customer = await createCustomer(toCreateCustomerBody(values));

      const driverRows = values.type === "company" ? (values.drivers ?? []) : [];
      if (driverRows.length === 0) {
        return { customer, driverResults: [] };
      }

      const driverBodies = driverRows.map(toCreateDriverBody);
      const driverResults = await attachDriversSequentially(customer.id, driverBodies);
      return { customer, driverResults };
    },
    onSuccess: (result) => {
      if (isFullSuccess(result)) {
        queryClient.invalidateQueries({ queryKey: ["customers"] });
      }
    },
  });
}

export interface AttachDriversInput {
  customerId: string;
  drivers: CreateDriverBody[];
}

/** Retries ONLY the given driver bodies against an already-created customer
 * id — never re-POSTs /customers (the partial-failure invariant: the
 * customer is not recreated on retry). */
export function useAttachDriversMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ customerId, drivers }: AttachDriversInput): Promise<DriverAttachResult[]> =>
      attachDriversSequentially(customerId, drivers),
    onSuccess: (results) => {
      if (results.every((r) => r.success)) {
        queryClient.invalidateQueries({ queryKey: ["customers"] });
      }
    },
  });
}
