/**
 * DTOs mirroring wheelio-api's customer HTTP contract 1:1.
 *
 * Source of truth: wheelio-api `internal/adapter/httpapi/customer_dto.go`
 * (`customerResponse`/`driverResponse`/`createCustomerRequest`/
 * `createDriverRequest`, json tags) and `internal/domain/customer/customer.go`
 * (type / identity_doc_type enum values). Any change to those Go types must
 * be mirrored here — this file is a read-only reflection of the backend
 * contract, never an independent source of truth.
 *
 * omitempty rule: every Go `omitempty` field is optional (`?:`) here — the
 * key is ABSENT from the JSON when unset, never `null` or `""`. Exceptions
 * are the two license date fields (`*string` in Go): they serialize as
 * `null` OR are absent, so they are modelled `string | null` and optional.
 * `archived_at` exists on the domain entity but is NOT part of the response
 * DTO (customer_dto.go:69-89) — it is deliberately not modelled here.
 */

/** customer_dto.go createCustomerRequest "type" — customer.go:20-22. */
export type CustomerType = "individual" | "company";

/** customer_dto.go createCustomerRequest "identity_doc_type" — customer.go:89-101. */
export type IdentityDocType = "cin" | "passport";

/** customerResponse — customer_dto.go:69-89. */
export interface CustomerResponse {
  id: string;
  type: CustomerType;
  // Individual
  full_name?: string;
  identity_doc_type?: IdentityDocType;
  identity_doc_number?: string;
  license_number?: string;
  license_issued_at?: string | null; // YYYY-MM-DD
  license_valid_until?: string | null; // YYYY-MM-DD
  // Company
  legal_name?: string;
  rc?: string;
  nif?: string;
  nis?: string;
  // Shared
  phone?: string;
  address?: string;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}

/** driverResponse — customer_dto.go:91-100. */
export interface DriverResponse {
  id: string;
  customer_id: string;
  full_name: string;
  license_number: string;
  license_issued_at?: string | null; // YYYY-MM-DD
  license_valid_until?: string | null; // YYYY-MM-DD
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}

/**
 * createCustomerRequest — customer_dto.go:18-35. Covers both individual and
 * company variants; the backend ignores fields belonging to the other
 * variant. Client-side (Zod) validation must encode the true per-type
 * requiredness — these transport-layer tags are all `omitempty`.
 */
export interface CreateCustomerBody {
  type: CustomerType;
  // Individual
  full_name?: string;
  identity_doc_type?: IdentityDocType;
  identity_doc_number?: string;
  license_number?: string;
  license_issued_at?: string | null;
  license_valid_until?: string | null;
  // Company
  legal_name?: string;
  rc?: string;
  nif?: string;
  nis?: string;
  // Shared
  phone?: string;
  address?: string;
}

/** createDriverRequest — customer_dto.go:53-58. customer_id is a path param, not a body field. */
export interface CreateDriverBody {
  full_name: string;
  license_number: string;
  license_issued_at?: string | null;
  license_valid_until?: string | null;
}
