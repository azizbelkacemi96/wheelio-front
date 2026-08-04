/**
 * DTOs mirroring wheelio-api's pricing module (moteur tarifaire) : vehicle
 * classes, rate seasons, the rate grid, and the quote preview. Amounts are in
 * DZD cents (integers, never float).
 */

export interface VehicleClass {
  id: string;
  name: string;
  display_order: number;
  default_deposit_cents?: number;
  active: boolean;
}

export interface VehicleClassBody {
  name: string;
  display_order: number;
  default_deposit_cents?: number | null;
  active?: boolean;
}

export interface RateSeason {
  id: string;
  name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;
  priority: number;
}

export interface RateSeasonBody {
  name: string;
  start_date: string;
  end_date: string;
  priority: number;
}

export interface RatePlan {
  id: string;
  class_id: string;
  season_id?: string;
  daily_cents: number;
  weekly_cents?: number;
  monthly_cents?: number;
}

export interface RatePlanBody {
  class_id: string;
  season_id?: string | null;
  daily_cents: number;
  weekly_cents?: number | null;
  monthly_cents?: number | null;
}

export interface RatePlanUpdateBody {
  daily_cents: number;
  weekly_cents?: number | null;
  monthly_cents?: number | null;
}

export type ExtraCategory = "protection" | "equipment" | "service" | "fee";
export type ExtraPricingMode = "per_day" | "flat" | "percent";

export interface RentalExtra {
  id: string;
  name: string;
  category: ExtraCategory;
  pricing_mode: ExtraPricingMode;
  amount_cents?: number;
  percent_bp?: number;
  default_selected: boolean;
  active: boolean;
  display_order: number;
}

export interface RentalExtraBody {
  name: string;
  category: ExtraCategory;
  pricing_mode: ExtraPricingMode;
  amount_cents?: number | null;
  percent_bp?: number | null;
  default_selected?: boolean;
  active?: boolean;
  display_order?: number;
}

export type DiscountKind = "fixed" | "percent";

export interface RateDiscount {
  id: string;
  name: string;
  code?: string;
  kind: DiscountKind;
  amount_cents?: number;
  percent_bp?: number;
  class_id?: string;
  valid_from?: string; // YYYY-MM-DD
  valid_to?: string;
  auto_apply: boolean;
  active: boolean;
}

export interface RateDiscountBody {
  name: string;
  code?: string | null;
  kind: DiscountKind;
  amount_cents?: number | null;
  percent_bp?: number | null;
  class_id?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  auto_apply?: boolean;
  active?: boolean;
}

export interface DepositRule {
  id: string;
  name: string;
  class_id?: string;
  requires_extra_id?: string;
  deposit_cents: number;
  priority: number;
  active: boolean;
}

export interface DepositRuleBody {
  name: string;
  class_id?: string | null;
  requires_extra_id?: string | null;
  deposit_cents: number;
  priority?: number;
  active?: boolean;
}

export interface QuoteBody {
  class_id: string;
  start_at: string; // ISO 8601
  end_at: string;
  extra_ids?: string[];
  discount_code?: string;
}

export interface QuoteExtraLine {
  id: string;
  name: string;
  amount_cents: number;
}

export interface QuoteResponse {
  duration_days: number;
  season_id?: string;
  season_name?: string;
  daily_cents: number;
  weekly_cents?: number;
  monthly_cents?: number;
  rental_cents: number;
  extras: QuoteExtraLine[];
  extras_cents: number;
  subtotal_cents: number;
  discounts: QuoteExtraLine[];
  discount_cents: number;
  total_cents: number;
  deposit_cents: number;
}
