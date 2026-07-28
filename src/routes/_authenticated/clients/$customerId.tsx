import { createFileRoute } from "@tanstack/react-router";
import { CustomerDetail } from "@/features/customers/CustomerDetail";

/**
 * /clients/$customerId — customer detail route (CUST-01/02/03, D-05).
 *
 * No loader: component-level useQuery is the established idiom (the list
 * route follows the same shape). The id comes from the path param and is
 * forwarded to CustomerDetail, which composes useCustomerQuery +
 * useCustomerDriversQuery. Replaces the 03-02/03-03 typed EmptyState stub.
 */
export const Route = createFileRoute("/_authenticated/clients/$customerId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { customerId } = Route.useParams();
  return <CustomerDetail customerId={customerId} />;
}
