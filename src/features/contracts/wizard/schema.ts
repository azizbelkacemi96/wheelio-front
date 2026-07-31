/**
 * Zod schema for the guided rental wizard (RENT-05). ONE schema for ONE React
 * Hook Form spanning all four steps; per-step validation is done by calling
 * `trigger(STEP_FIELDS[stepIndex])` so only the current step's fields gate the
 * Next button.
 *
 * Dates are captured as zone-less `datetime-local` strings; 04-01's
 * toRFC3339Algiers converts them to the backend's RFC3339 at finish time.
 * Deposit is OPTIONAL and lives in the terms step (not its own step). Fuel
 * levels + deposit methods mirror the backend enums.
 */
import { z } from "zod";

export const FUEL_LEVELS = [
  "empty",
  "quarter",
  "half",
  "three_quarters",
  "full",
] as const;

export const DEPOSIT_METHODS = ["cash", "card", "transfer"] as const;

/** datetime-local + empty selects arrive as "" — normalize to undefined so an
 * untouched optional field is absent, not an invalid empty value. */
const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

export const wizardSchema = z
  .object({
    vehicle_id: z.string().uuid(),
    customer_id: z.string().uuid(),
    starts_at_local: z.string().min(1),
    ends_at_local: z.string().min(1),
    deposit_amount: z.preprocess(
      emptyToUndefined,
      z.coerce.number().min(0).optional(),
    ),
    deposit_method: z.preprocess(
      emptyToUndefined,
      z.enum(DEPOSIT_METHODS).optional(),
    ),
    departure_mileage: z.coerce.number().int().gte(0),
    departure_fuel: z.enum(FUEL_LEVELS),
    activate_now: z.boolean().default(true),
  })
  .refine(
    (v) =>
      !v.starts_at_local ||
      !v.ends_at_local ||
      new Date(v.ends_at_local) > new Date(v.starts_at_local),
    { path: ["ends_at_local"], message: "contracts.errors.endBeforeStart" },
  );

export type WizardValues = z.infer<typeof wizardSchema>;

/** Fields each step's Next button must validate via trigger(). Deposit fields
 * are intentionally NOT gated (they are optional and validate on finish). */
export const STEP_FIELDS: ReadonlyArray<ReadonlyArray<keyof WizardValues>> = [
  ["vehicle_id"],
  ["customer_id"],
  ["starts_at_local", "ends_at_local"],
  ["departure_mileage", "departure_fuel"],
];

export const STEP_COUNT = STEP_FIELDS.length;
