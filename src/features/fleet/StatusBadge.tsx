/**
 * One token-mapped Badge per backend vehicle status (D-02). The label ALWAYS
 * comes from i18n (D-07) — raw enum strings never reach the DOM. The style
 * map is typed Record<VehicleStatus, string>, so a new backend status value
 * fails tsc (the repo's DTO drift-detection idiom).
 */
import { useTranslation } from "react-i18next";
import type { VehicleStatus } from "@/types/fleet";
import { Badge } from "@/shared/ui/badge";

const statusStyles: Record<VehicleStatus, string> = {
  available: "bg-success/10 text-success",
  rented: "bg-primary/10 text-primary",
  maintenance: "bg-warning/10 text-warning",
  retired: "border-border text-muted-foreground",
};

export function StatusBadge({ status }: { status: VehicleStatus }) {
  const { t } = useTranslation();
  return (
    <Badge variant="outline" className={statusStyles[status]}>
      {t(`vehicles.status.${status}`)}
    </Badge>
  );
}
