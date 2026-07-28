import type { CustomerResponse, DriverResponse } from "@/types/customer";

/**
 * Customer fixtures typed against the DTO mirror (types/customer.ts) so any
 * backend-contract drift fails compilation.
 *
 * Coverage guarantees relied on by the MSW handlers and hook tests:
 * - `customerIndividualCin` covers the individual + cin path (identity_doc_number set);
 * - `customerIndividualPassport` covers the individual + passport path with NO
 *   identity_doc_number (passport-optional path per customer.go:91);
 * - `customerCompany` covers the company path (legal_name + rc + nif + nis);
 * - `customerBare` has EVERY omitempty field ABSENT — keeps to the
 *   "absent, never null/empty" contract honest (see types/customer.ts).
 *
 * Customers are org-scoped (D-07/D-08): NO agency_id field anywhere here.
 */

const now = "2026-01-01T00:00:00.000Z";

export const customerIndividualCin: CustomerResponse = {
  id: "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1",
  type: "individual",
  full_name: "Yacine Belkacem",
  identity_doc_type: "cin",
  identity_doc_number: "123456789012",
  license_number: "AL-2021-004512",
  license_issued_at: "2021-05-10",
  license_valid_until: "2031-05-10",
  phone: "+213551234567",
  address: "18 Rue Larbi Ben M'hidi, Alger",
  created_at: now,
  updated_at: now,
};

export const customerIndividualPassport: CustomerResponse = {
  id: "c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2",
  type: "individual",
  full_name: "Sofia Martins",
  identity_doc_type: "passport",
  // identity_doc_number deliberately ABSENT — optional on the passport path.
  license_number: "PT-2019-887711",
  phone: "+351912345678",
  created_at: now,
  updated_at: now,
};

export const customerCompany: CustomerResponse = {
  id: "c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3",
  type: "company",
  legal_name: "SARL Transport Hamdi",
  rc: "16/00-1234567 B 21",
  nif: "000216123456789",
  nis: "216123456789012",
  phone: "+213211987654",
  address: "Zone Industrielle Oued Smar, Alger",
  created_at: now,
  updated_at: now,
};

/** ALL omitempty fields absent — keeps optional-field handling honest. */
export const customerBare: CustomerResponse = {
  id: "c4c4c4c4-c4c4-4c4c-8c4c-c4c4c4c4c4c4",
  type: "individual",
  created_at: now,
  updated_at: now,
};

export const customerFixtures: CustomerResponse[] = [
  customerIndividualCin,
  customerIndividualPassport,
  customerCompany,
  customerBare,
];

export const driverHamdiA: DriverResponse = {
  id: "d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1",
  customer_id: customerCompany.id,
  full_name: "Karim Hamdi",
  license_number: "AL-2018-009911",
  license_issued_at: "2018-02-01",
  license_valid_until: "2028-02-01",
  created_at: now,
  updated_at: now,
};

export const driverHamdiB: DriverResponse = {
  id: "d2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2",
  customer_id: customerCompany.id,
  full_name: "Nadia Hamdi",
  license_number: "AL-2020-002233",
  created_at: now,
  updated_at: now,
};

export const driverFixtures: DriverResponse[] = [driverHamdiA, driverHamdiB];

/** customerId -> its drivers, for the MSW handlers to filter over. */
export const driversByCustomerId: Record<string, DriverResponse[]> = {
  [customerCompany.id]: [driverHamdiA, driverHamdiB],
};
