/**
 * Small vehicle thumbnail for the fleet list — shows the vehicle's first photo
 * (an image document) so a car is recognizable at a glance. Falls back to a
 * neutral car icon when there is no photo. The image is loaded via the
 * short-lived signed URL (no auth header needed on the <img>).
 *
 * Per-vehicle lazy fetch (documents + signed URL), cached by react-query — fine
 * for the counter-sized fleets this app targets.
 */
import { useEffect, useState } from "react";
import { Car } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDocumentDownloadURL } from "@/features/documents/api";
import { useVehicleDocumentsQuery } from "@/features/documents/queries";

export function VehicleThumbnail({
  vehicleId,
  className,
}: {
  vehicleId: string;
  className?: string;
}) {
  const docsQuery = useVehicleDocumentsQuery(vehicleId);
  const firstImage = (docsQuery.data ?? []).find((d) =>
    d.content_type.startsWith("image/"),
  );
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!firstImage) {
      setUrl(null);
      return;
    }
    let active = true;
    getDocumentDownloadURL(firstImage.id)
      .then((s) => active && setUrl(s.url))
      .catch(() => active && setUrl(null));
    return () => {
      active = false;
    };
  }, [firstImage]);

  const box = cn(
    "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted",
    className,
  );

  if (url) {
    return (
      <span className={box}>
        <img src={url} alt="" className="size-full object-cover" />
      </span>
    );
  }
  return (
    <span className={box} aria-hidden="true">
      <Car className="size-5 text-muted-foreground" />
    </span>
  );
}
