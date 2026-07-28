import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/shared/ui/empty-state";

/**
 * /contrats/nouveau — typed EmptyState STUB, pulled forward so ContractList's
 * "New contract" CTA Link (`to="/contrats/nouveau"`) type-checks under
 * `tsc -b` now. Being a STATIC segment it outranks the `$contractId` dynamic
 * route. The real new-contract wizard is filled by plan 04-04.
 */
export const Route = createFileRoute("/_authenticated/contrats/nouveau")({
  component: EmptyState,
});
