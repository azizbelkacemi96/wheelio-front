/**
 * One token-mapped Badge per backend contract status (D-01). The label ALWAYS
 * comes from i18n (`contracts.status.*`) — raw enum strings never reach the
 * DOM. The style map is typed `Record<ContractStatus, string>`, so a new
 * backend status value fails tsc (the repo's DTO drift-detection idiom,
 * mirroring fleet/StatusBadge.tsx).
 *
 * A rental "visibly moves" reserved -> active -> closed on the list, so each
 * status gets a distinct token: reserved = primary tint (a future booking),
 * active = warning tint (a live rental out on the road), closed = success tint
 * (settled), cancelled = muted/border (inert).
 */
import { useTranslation } from "react-i18next";
import type { ContractStatus } from "@/types/rental";
import { Badge } from "@/shared/ui/badge";

const statusStyles: Record<ContractStatus, string> = {
  reserved: "bg-primary/10 text-primary",
  active: "bg-warning/10 text-warning",
  closed: "bg-success/10 text-success",
  cancelled: "border-border text-muted-foreground",
};

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  const { t } = useTranslation();
  return (
    <Badge variant="outline" className={statusStyles[status]}>
      {t(`contracts.status.${status}`)}
    </Badge>
  );
}
