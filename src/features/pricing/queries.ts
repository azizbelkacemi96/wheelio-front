/**
 * Pricing read layer — TanStack Query hooks over api.ts. Keys namespaced
 * ["pricing", ...]. Rate plans are per-class (keyed by class id).
 */
import { useQuery } from "@tanstack/react-query";
import {
  listDepositRules,
  listRateDiscounts,
  listRatePlans,
  listRateSeasons,
  listRentalExtras,
  listVehicleClasses,
} from "./api";

export const CLASSES_KEY = ["pricing", "classes"] as const;
export const SEASONS_KEY = ["pricing", "seasons"] as const;
export const EXTRAS_KEY = ["pricing", "extras"] as const;
export const DISCOUNTS_KEY = ["pricing", "discounts"] as const;
export const DEPOSIT_RULES_KEY = ["pricing", "depositRules"] as const;

export function useVehicleClassesQuery(enabled = true) {
  return useQuery({ queryKey: CLASSES_KEY, queryFn: listVehicleClasses, enabled });
}

export function useRateSeasonsQuery(enabled = true) {
  return useQuery({ queryKey: SEASONS_KEY, queryFn: listRateSeasons, enabled });
}

export function useRentalExtrasQuery(enabled = true) {
  return useQuery({ queryKey: EXTRAS_KEY, queryFn: listRentalExtras, enabled });
}

export function useRateDiscountsQuery(enabled = true) {
  return useQuery({ queryKey: DISCOUNTS_KEY, queryFn: listRateDiscounts, enabled });
}

export function useDepositRulesQuery(enabled = true) {
  return useQuery({ queryKey: DEPOSIT_RULES_KEY, queryFn: listDepositRules, enabled });
}

export function useRatePlansQuery(classId: string, enabled = true) {
  return useQuery({
    queryKey: ["pricing", "ratePlans", classId],
    queryFn: () => listRatePlans(classId),
    enabled: enabled && classId !== "",
  });
}
