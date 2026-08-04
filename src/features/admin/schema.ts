/**
 * Zod schemas for the admin forms (Phase 9). Mirror the backend createUser /
 * agency request constraints (password min 8, org_role admin|member,
 * country_code 2 letters).
 */
import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

export const ORG_ROLES = ["admin", "member"] as const;

export const createUserSchema = z.object({
  first_name: z.string().trim().min(1, "admin.users.errors.firstNameRequired"),
  last_name: z.string().trim().min(1, "admin.users.errors.lastNameRequired"),
  email: z.string().trim().email("admin.users.errors.emailInvalid"),
  password: z.string().min(8, "admin.users.errors.passwordShort"),
  org_role: z.enum(ORG_ROLES),
});
export type CreateUserValues = z.infer<typeof createUserSchema>;

export const agencySchema = z.object({
  name: z.string().trim().min(1, "admin.agencies.errors.nameRequired"),
  address_line: z.preprocess(emptyToUndefined, z.string().optional()),
  city: z.preprocess(emptyToUndefined, z.string().optional()),
  postal_code: z.preprocess(emptyToUndefined, z.string().optional()),
  country_code: z.preprocess(
    emptyToUndefined,
    z.string().length(2, "admin.agencies.errors.countryCode").optional(),
  ),
  phone: z.preprocess(emptyToUndefined, z.string().optional()),
});
export type AgencyValues = z.infer<typeof agencySchema>;
