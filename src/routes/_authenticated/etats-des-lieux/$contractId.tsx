import { createFileRoute } from "@tanstack/react-router";
import { InspectionScreen } from "@/features/inspections/InspectionScreen";

/**
 * /etats-des-lieux/$contractId — the contract-scoped inspection capture screen
 * (INSP-01/02/03). The id comes from the path param and is forwarded to
 * InspectionScreen, which composes the contract + vehicle (for the plate and
 * the canOperate gate) and runs the create → damage → photo → validate flow.
 */
export const Route = createFileRoute("/_authenticated/etats-des-lieux/$contractId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { contractId } = Route.useParams();
  return <InspectionScreen contractId={contractId} />;
}
