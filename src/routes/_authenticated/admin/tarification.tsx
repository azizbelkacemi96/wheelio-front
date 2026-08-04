import { createFileRoute } from "@tanstack/react-router";
import { PricingAdmin } from "@/features/pricing/PricingAdmin";

/**
 * "Tarification" — org-admin pricing catalogue (vehicle classes, seasons, the
 * rate grid) plus a quote calculator. The pricing engine is the foundation for
 * quotes and a future online booking flow.
 */
export const Route = createFileRoute("/_authenticated/admin/tarification")({
  component: PricingAdmin,
});
