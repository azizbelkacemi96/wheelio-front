import { createFileRoute } from "@tanstack/react-router";
import { PlanningBoard } from "@/features/planning/PlanningBoard";

/**
 * "Planning" — the fleet calendar (PLAN-01): a week/month timeline of vehicles
 * with their bookings and unavailability. Read-only view over GET /planning.
 */
export const Route = createFileRoute("/_authenticated/planning")({
  component: PlanningBoard,
});
