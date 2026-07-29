/**
 * Shared helpers for the lifecycle forms.
 *
 * `translatedError` mirrors CustomerCreateForm's idiom: zod messages on these
 * schemas are i18n KEYS (contracts.errors.*), so every FieldError boundary
 * resolves the key through t() before rendering — no raw key ever reaches the
 * DOM (threat T-04-04). `FUEL_LEVELS` is the single ordered source for the
 * fuel Select in both ActivateForm and CloseForm, keyed to the FuelLevel enum
 * so a backend enum change surfaces here.
 */
import type { FuelLevel } from "@/types/rental";

/** Ordered fuel levels for the departure/return Select — labels via i18n. */
export const FUEL_LEVELS: readonly FuelLevel[] = [
  "empty",
  "quarter",
  "half",
  "three_quarters",
  "full",
];

/** Resolve an i18n-key zod message into a translated FieldError item. */
export function translatedError(
  t: (key: string) => string,
  error?: { message?: string },
): Array<{ message?: string }> | undefined {
  return error?.message ? [{ message: t(error.message) }] : undefined;
}
