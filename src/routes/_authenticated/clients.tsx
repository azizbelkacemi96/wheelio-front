import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/shared/ui/empty-state";

/** "Clients" placeholder route — real customer screens are a later phase's scope. */
export const Route = createFileRoute("/_authenticated/clients")({
  component: EmptyState,
});
