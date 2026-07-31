import { createFileRoute } from "@tanstack/react-router";
import { InspectionsIndex } from "@/features/inspections/InspectionsIndex";

/**
 * /etats-des-lieux — the inspection landing (INSP-01/03). Lists the contracts
 * an inspection can be run against; replaces the 01-07 EmptyState placeholder
 * (the last base-nav placeholder to become real).
 */
export const Route = createFileRoute("/_authenticated/etats-des-lieux/")({
  component: InspectionsIndex,
});
