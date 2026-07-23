import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/shared/ui/empty-state";

/** "États des lieux" placeholder route — real inspection screens are a later phase's scope. */
export const Route = createFileRoute("/_authenticated/etats-des-lieux")({
  component: EmptyState,
});
