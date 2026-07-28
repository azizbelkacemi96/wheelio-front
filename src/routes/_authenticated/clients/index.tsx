import { createFileRoute } from "@tanstack/react-router";
import { CustomerList } from "@/features/customers/CustomerList";

/**
 * /clients — the real customer list screen (CUST-03), replacing the Phase 1
 * placeholder. No loader: Phase 1 established component-level useQuery
 * (02-RESEARCH.md "Alternatives Considered") — CustomerList owns its own
 * data fetching via useCustomersQuery.
 */
export const Route = createFileRoute("/_authenticated/clients/")({
  component: CustomerList,
});
