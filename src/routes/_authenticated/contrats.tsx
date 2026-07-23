import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/shared/ui/empty-state";

/** "Contrats" placeholder route — real rental-contract screens are a later phase's scope. */
export const Route = createFileRoute("/_authenticated/contrats")({
  component: EmptyState,
});
