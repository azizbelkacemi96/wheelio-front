/**
 * Zod validation for the customer create form (CUST-01/CUST-02).
 *
 * Encodes the DOMAIN requiredness (customer.go applyDetails/NewCustomer),
 * NOT the loose transport-layer `omitempty` tags on createCustomerRequest
 * (customer_dto.go:18-35) — full_name is required for individual,
 * legal_name+rc for company, identity_doc_number only when
 * identity_doc_type is "cin". No format regex on CIN/RC/NIF/NIS/license:
 * the backend deliberately has none (customer.go:221-232) — length bounds
 * only (03-RESEARCH.md Pitfall 3, D-09).
 *
 * `drivers` is present (optional) on BOTH the individual and company object
 * shapes so the field exists uniformly across the discriminated union's
 * output type for react-hook-form's useFieldArray typing — only the company
 * branch renders/submits it; individual customers never send a drivers
 * array (mutations.ts only reads values.drivers when type === "company").
 *
 * Validation messages are i18n KEYS (customers.errors.*), resolved via
 * t() at render in the FieldError boundary, matching the auth form
 * convention (D-06) — never a bare English/French string here.
 */
import { z } from "zod";

const licenseDates = {
  license_number: z.string().max(30).optional(),
  license_issued_at: z.string().optional(), // YYYY-MM-DD
  license_valid_until: z.string().optional(), // YYYY-MM-DD
};

/** createDriverRequest — customer_dto.go:53-58. Unlike the customer's
 * optional license, driver full_name/license_number are REQUIRED. */
export const driverSchema = z
  .object({
    full_name: z.string().min(1).max(200),
    license_number: z.string().min(1).max(30),
    license_issued_at: z.string().optional(),
    license_valid_until: z.string().optional(),
  })
  .refine(
    (v) =>
      !v.license_issued_at ||
      !v.license_valid_until ||
      v.license_valid_until > v.license_issued_at,
    {
      path: ["license_valid_until"],
      message: "customers.errors.licenseDateOrder",
    },
  );

export type DriverFormValues = z.infer<typeof driverSchema>;

const individual = z.object({
  type: z.literal("individual"),
  full_name: z.string().min(1).max(200), // domain-required (customer.go:161)
  identity_doc_type: z.enum(["cin", "passport"]),
  identity_doc_number: z.string().max(30).optional(), // required-when-cin, refined below
  ...licenseDates,
  drivers: z.array(driverSchema).optional(),
});

const company = z.object({
  type: z.literal("company"),
  legal_name: z.string().min(1).max(200), // domain-required (customer.go:167)
  rc: z.string().min(1).max(30), // pivot, required (customer.go:106)
  nif: z.string().max(30).optional(),
  nis: z.string().max(30).optional(),
  ...licenseDates,
  drivers: z.array(driverSchema).optional(),
});

const shared = {
  phone: z.string().max(30).optional(),
  address: z.string().max(300).optional(),
};

export const customerSchema = z
  .discriminatedUnion("type", [individual.extend(shared), company.extend(shared)])
  .refine(
    (v) =>
      v.type !== "individual" ||
      v.identity_doc_type !== "cin" ||
      (v.identity_doc_number?.trim().length ?? 0) >= 1,
    { path: ["identity_doc_number"], message: "customers.errors.cinRequired" },
  )
  .refine(
    (v) =>
      !v.license_issued_at ||
      !v.license_valid_until ||
      v.license_valid_until > v.license_issued_at,
    { path: ["license_valid_until"], message: "customers.errors.licenseDateOrder" },
  );

export type CustomerFormOutput = z.infer<typeof customerSchema>;

/**
 * Flat react-hook-form values type — every field optional except the
 * discriminator. Deliberately NOT `z.infer<typeof customerSchema>`: that
 * output type is a true discriminated union (fields absent, not merely
 * optional, on the inactive branch), which RHF's Path<T>/register()
 * typing does not resolve cleanly for a single toggled form. zodResolver
 * is cast to this flat shape in CustomerCreateForm.tsx — the runtime
 * validation still runs the real discriminated union + both refines;
 * only the compile-time field-path typing is relaxed.
 */
export interface CustomerFormValues {
  type: "individual" | "company";
  full_name?: string;
  identity_doc_type?: "cin" | "passport";
  identity_doc_number?: string;
  license_number?: string;
  license_issued_at?: string;
  license_valid_until?: string;
  legal_name?: string;
  rc?: string;
  nif?: string;
  nis?: string;
  phone?: string;
  address?: string;
  drivers?: DriverFormValues[];
}
