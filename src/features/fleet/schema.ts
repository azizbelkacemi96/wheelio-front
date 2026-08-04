/**
 * Zod schema for the vehicle create/edit form (Phase 8). Enum option lists +
 * validation both come from these `as const` arrays. Mirrors the backend
 * createVehicleRequest/updateVehicleRequest constraints (vin len 17, fuel/
 * transmission oneofs, year 1950-2100, seats 1-9, mileage gte 0). Purchase
 * price is entered in DZD and converted to cents at submit.
 */
import { z } from "zod";

export const FUEL_TYPES = ["petrol", "diesel", "hybrid", "electric", "lpg"] as const;
export const TRANSMISSIONS = ["manual", "automatic"] as const;

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

const baseVehicle = {
  registration_plate: z.string().trim().min(1, "fleet.errors.plateRequired"),
  brand: z.string().trim().min(1, "fleet.errors.brandRequired"),
  model: z.string().trim().min(1, "fleet.errors.modelRequired"),
  model_year: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().gte(1950).lte(2100).optional(),
  ),
  color: z.preprocess(emptyToUndefined, z.string().optional()),
  fuel_type: z.enum(FUEL_TYPES),
  transmission: z.enum(TRANSMISSIONS),
  seats: z.preprocess(emptyToUndefined, z.coerce.number().int().gte(1).lte(9).optional()),
  purchase_date: z.preprocess(emptyToUndefined, z.string().optional()),
  purchase_price_dzd: z.preprocess(
    emptyToUndefined,
    z.coerce.number().gte(0).optional(),
  ),
  notes: z.preprocess(emptyToUndefined, z.string().optional()),
  class_id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
};

export const createVehicleSchema = z.object({
  ...baseVehicle,
  agency_id: z.string().uuid("fleet.errors.agencyRequired"),
  vin: z.string().trim().length(17, "fleet.errors.vinLength"),
  initial_mileage: z.coerce.number().int().gte(0),
});
export type CreateVehicleValues = z.infer<typeof createVehicleSchema>;

export const editVehicleSchema = z.object(baseVehicle);
export type EditVehicleValues = z.infer<typeof editVehicleSchema>;
