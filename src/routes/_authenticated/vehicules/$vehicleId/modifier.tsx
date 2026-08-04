import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/shared/ui/skeleton";
import { useVehicleQuery } from "@/features/fleet/queries";
import { VehicleForm } from "@/features/fleet/VehicleForm";

/** /vehicules/$vehicleId/modifier — edit an existing vehicle (Phase 8). Loads
 * the vehicle to prefill the form, then PATCHes on submit. */
export const Route = createFileRoute("/_authenticated/vehicules/$vehicleId/modifier")({
  component: RouteComponent,
});

function RouteComponent() {
  const { vehicleId } = Route.useParams();
  const { t } = useTranslation();
  const query = useVehicleQuery(vehicleId);

  if (query.isPending) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 md:p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <div className="mx-auto w-full max-w-2xl p-4 md:p-6">
        <p role="alert" className="text-sm text-destructive">
          {t("vehicles.loadError")}
        </p>
      </div>
    );
  }
  return <VehicleForm mode="edit" vehicle={query.data} />;
}
