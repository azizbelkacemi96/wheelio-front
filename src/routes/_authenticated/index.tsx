import { createFileRoute } from "@tanstack/react-router";
import { OpsToday } from "@/features/contracts/OpsToday";

/**
 * "Aujourd'hui" landing route ("/") — the OPS-01 today overview (pickups +
 * returns due today, Africa/Algiers). Replaces the phase-1 placeholder.
 */
export const Route = createFileRoute("/_authenticated/")({
  component: OpsToday,
});
