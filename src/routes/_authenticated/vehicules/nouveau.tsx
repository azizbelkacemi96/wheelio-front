import { createFileRoute } from "@tanstack/react-router";
import { VehicleForm } from "@/features/fleet/VehicleForm";

/** /vehicules/nouveau — create a vehicle (Phase 8). Gating is UX-only (the list
 * hides the CTA for non-managers); the backend re-enforces create authz. */
export const Route = createFileRoute("/_authenticated/vehicules/nouveau")({
  component: () => <VehicleForm mode="create" />,
});
