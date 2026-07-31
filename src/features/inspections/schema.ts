/**
 * Zod schemas for the inspection capture flow (INSP-01/03). Both the
 * validation `oneof`s AND the UI option lists are driven from the `as const`
 * enum arrays in src/types/inspection.ts — never a client-invented list
 * (D-02/D-03). Fuel reuses FUEL_LEVELS (the same 5-value backend enum shared
 * with the rental wizard).
 */
import { z } from "zod";
import { FUEL_LEVELS } from "@/features/contracts/wizard/schema";
import { DAMAGE_TYPES, INSPECTION_KINDS, SEVERITIES, ZONES } from "@/types/inspection";

/** Create-inspection form (kind + mileage + fuel). Mirrors the backend
 * createInspectionRequest: mileage gte=0, fuel required oneof. */
export const createInspectionSchema = z.object({
  kind: z.enum(INSPECTION_KINDS),
  mileage: z.coerce.number().int().gte(0),
  fuel: z.enum(FUEL_LEVELS),
});
export type CreateInspectionValues = z.infer<typeof createInspectionSchema>;

/** empty selects/inputs arrive as "" — normalize optional free strings to
 * undefined so an untouched field is absent, not an empty value. */
const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

/** Record-damage form. zone/type/severity are required closed enums; position
 * and description are optional free strings (backend `omitempty`). */
export const damageSchema = z.object({
  zone: z.enum(ZONES),
  damage_type: z.enum(DAMAGE_TYPES),
  severity: z.enum(SEVERITIES),
  position: z.preprocess(emptyToUndefined, z.string().max(500).optional()),
  description: z.preprocess(emptyToUndefined, z.string().max(2000).optional()),
});
export type DamageValues = z.infer<typeof damageSchema>;
