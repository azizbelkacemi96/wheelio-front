import { createFileRoute } from "@tanstack/react-router";
import { CustomerCreateForm } from "@/features/customers/CustomerCreateForm";

/**
 * /clients/nouveau — customer create screen (CUST-01/CUST-02). No loader:
 * component-level mutation is the established idiom (mirrors the vehicules
 * route shape) — CustomerCreateForm owns its own submission flow via
 * useCreateCustomerMutation/useAttachDriversMutation.
 */
export const Route = createFileRoute("/_authenticated/clients/nouveau")({
  component: CustomerCreateForm,
});
