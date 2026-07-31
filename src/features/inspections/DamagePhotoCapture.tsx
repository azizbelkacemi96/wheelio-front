/**
 * On-site photo capture for ONE damage (INSP-02). Native camera/file input
 * (`capture="environment"`) — no native app (D-04). Each photo is an
 * independent tile showing its live upload status; a `failed` photo exposes a
 * manual Retry, and nothing is ever silently dropped. Mobile-first: large
 * touch targets, works one-handed at the vehicle (D-08).
 *
 * `photoOptions` is threaded down for tests (fast fake compress/upload/attach);
 * production leaves it undefined so useDamagePhotos wires the real ky-backed
 * pipeline + canvas compression.
 */
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Camera, RotateCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/ui/button";
import { useDamagePhotos, type UseDamagePhotosOptions } from "./upload/useDamagePhotos";
import type { PhotoStatus } from "./upload/photoUploadMachine";

const STATUS_TONE: Record<PhotoStatus, string> = {
  queued: "text-muted-foreground",
  compressing: "text-muted-foreground",
  uploading: "text-primary",
  uploaded: "text-primary",
  attaching: "text-primary",
  attached: "text-emerald-600 dark:text-emerald-400",
  failed: "text-destructive",
};

export function DamagePhotoCapture({
  damageId,
  vehicleId,
  onReadyChange,
  photoOptions,
}: {
  damageId: string;
  vehicleId: string;
  /** reports whether this damage now has ≥1 attached photo (Validate gate). */
  onReadyChange?: (hasAttached: boolean) => void;
  photoOptions?: UseDamagePhotosOptions;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const { photos, addFiles, retry, remove, hasAttached } = useDamagePhotos(
    damageId,
    vehicleId,
    photoOptions,
  );

  useEffect(() => {
    onReadyChange?.(hasAttached);
  }, [hasAttached, onReadyChange]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">
          {t("inspections.photos.title")}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => inputRef.current?.click()}
        >
          <Camera className="size-4" aria-hidden={true} />
          {t("inspections.photos.add")}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          aria-label={t("inspections.photos.add")}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = ""; // allow re-picking the same file
          }}
        />
      </div>

      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("inspections.photos.empty")}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <li
              key={photo.id}
              className="flex flex-col gap-1 rounded-lg border border-border p-2"
            >
              {photo.previewUrl ? (
                // eslint-disable-next-line jsx-a11y/img-redundant-alt
                <img
                  src={photo.previewUrl}
                  alt={t("inspections.photos.title")}
                  className="aspect-[4/3] w-full rounded-md object-cover"
                />
              ) : (
                <div className="aspect-[4/3] w-full rounded-md bg-muted" />
              )}
              <div className="flex items-center justify-between gap-1">
                <span className={cn("text-xs font-medium", STATUS_TONE[photo.status])}>
                  {t(`inspections.photos.status.${photo.status}`)}
                </span>
                <div className="flex items-center gap-1">
                  {photo.status === "failed" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => retry(photo.id)}
                    >
                      <RotateCw className="size-3.5" aria-hidden={true} />
                      {t("inspections.photos.retry")}
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    aria-label={t("inspections.photos.remove")}
                    onClick={() => remove(photo.id)}
                  >
                    <X className="size-3.5" aria-hidden={true} />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
