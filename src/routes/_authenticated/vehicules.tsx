import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/shared/ui/empty-state";

/** "Véhicules" placeholder route — real fleet screens are Phase 2 scope. */
export const Route = createFileRoute("/_authenticated/vehicules")({
  component: EmptyState,
});
