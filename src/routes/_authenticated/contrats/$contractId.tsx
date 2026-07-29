import { createFileRoute } from "@tanstack/react-router";
import { ContractDetail } from "@/features/contracts/ContractDetail";

/**
 * /contrats/$contractId — contract detail route (RENT-02/03/04, D-03).
 *
 * No loader: component-level useQuery is the established idiom (clients/
 * $customerId + vehicules/$vehicleId precedent). The id comes from the path
 * param and is forwarded to ContractDetail, which composes useContractQuery +
 * useVehicleQuery + useCustomerQuery. Replaces the 04-02 typed EmptyState stub.
 */
export const Route = createFileRoute("/_authenticated/contrats/$contractId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { contractId } = Route.useParams();
  return <ContractDetail contractId={contractId} />;
}
