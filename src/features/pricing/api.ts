/**
 * Pricing HTTP calls (moteur tarifaire). Catalogue writes are org-admin
 * operations (backend re-enforces; the UI gates on isOrgAdmin). Thin functions
 * over the shared `api` ky client.
 */
import { api } from "@/shared/api/client";
import type {
  DepositRule,
  DepositRuleBody,
  QuoteBody,
  QuoteResponse,
  RatePlan,
  RatePlanBody,
  RatePlanUpdateBody,
  RateSeason,
  RateSeasonBody,
  RateDiscount,
  RateDiscountBody,
  RentalExtra,
  RentalExtraBody,
  VehicleClass,
  VehicleClassBody,
} from "@/types/pricing";

function enc(id: string): string {
  return encodeURIComponent(id);
}

// ---- Vehicle classes ----

export function listVehicleClasses(): Promise<VehicleClass[]> {
  return api.get("vehicle-classes").json<VehicleClass[]>();
}

export function createVehicleClass(body: VehicleClassBody): Promise<VehicleClass> {
  return api.post("vehicle-classes", { json: body }).json<VehicleClass>();
}

export function updateVehicleClass(id: string, body: VehicleClassBody): Promise<VehicleClass> {
  return api.patch(`vehicle-classes/${enc(id)}`, { json: body }).json<VehicleClass>();
}

export function deleteVehicleClass(id: string): Promise<void> {
  return api.delete(`vehicle-classes/${enc(id)}`).then(() => undefined);
}

// ---- Rate seasons ----

export function listRateSeasons(): Promise<RateSeason[]> {
  return api.get("rate-seasons").json<RateSeason[]>();
}

export function createRateSeason(body: RateSeasonBody): Promise<RateSeason> {
  return api.post("rate-seasons", { json: body }).json<RateSeason>();
}

export function deleteRateSeason(id: string): Promise<void> {
  return api.delete(`rate-seasons/${enc(id)}`).then(() => undefined);
}

// ---- Rate plans ----

export function listRatePlans(classId: string): Promise<RatePlan[]> {
  return api.get(`vehicle-classes/${enc(classId)}/rate-plans`).json<RatePlan[]>();
}

export function createRatePlan(body: RatePlanBody): Promise<RatePlan> {
  return api.post("rate-plans", { json: body }).json<RatePlan>();
}

export function updateRatePlan(id: string, body: RatePlanUpdateBody): Promise<RatePlan> {
  return api.patch(`rate-plans/${enc(id)}`, { json: body }).json<RatePlan>();
}

export function deleteRatePlan(id: string): Promise<void> {
  return api.delete(`rate-plans/${enc(id)}`).then(() => undefined);
}

// ---- Rental extras ----

export function listRentalExtras(): Promise<RentalExtra[]> {
  return api.get("rental-extras").json<RentalExtra[]>();
}

export function createRentalExtra(body: RentalExtraBody): Promise<RentalExtra> {
  return api.post("rental-extras", { json: body }).json<RentalExtra>();
}

export function updateRentalExtra(id: string, body: RentalExtraBody): Promise<RentalExtra> {
  return api.patch(`rental-extras/${enc(id)}`, { json: body }).json<RentalExtra>();
}

export function deleteRentalExtra(id: string): Promise<void> {
  return api.delete(`rental-extras/${enc(id)}`).then(() => undefined);
}

// ---- Rate discounts ----

export function listRateDiscounts(): Promise<RateDiscount[]> {
  return api.get("rate-discounts").json<RateDiscount[]>();
}

export function createRateDiscount(body: RateDiscountBody): Promise<RateDiscount> {
  return api.post("rate-discounts", { json: body }).json<RateDiscount>();
}

export function updateRateDiscount(id: string, body: RateDiscountBody): Promise<RateDiscount> {
  return api.patch(`rate-discounts/${enc(id)}`, { json: body }).json<RateDiscount>();
}

export function deleteRateDiscount(id: string): Promise<void> {
  return api.delete(`rate-discounts/${enc(id)}`).then(() => undefined);
}

// ---- Deposit rules ----

export function listDepositRules(): Promise<DepositRule[]> {
  return api.get("deposit-rules").json<DepositRule[]>();
}

export function createDepositRule(body: DepositRuleBody): Promise<DepositRule> {
  return api.post("deposit-rules", { json: body }).json<DepositRule>();
}

export function updateDepositRule(id: string, body: DepositRuleBody): Promise<DepositRule> {
  return api.patch(`deposit-rules/${enc(id)}`, { json: body }).json<DepositRule>();
}

export function deleteDepositRule(id: string): Promise<void> {
  return api.delete(`deposit-rules/${enc(id)}`).then(() => undefined);
}

// ---- Quote ----

export function previewQuote(body: QuoteBody): Promise<QuoteResponse> {
  return api.post("quotes/preview", { json: body }).json<QuoteResponse>();
}
