import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/shared/ui/empty-state";

/**
 * /contrats/$contractId — typed EmptyState STUB, pulled forward so
 * ContractList's per-row Link (`to="/contrats/$contractId"`) type-checks under
 * `tsc -b` now (the 02-02 $vehicleId / 03-02 $customerId precedent). The real
 * contract-detail screen is filled by plan 04-03.
 */
export const Route = createFileRoute("/_authenticated/contrats/$contractId")({
  component: EmptyState,
});
