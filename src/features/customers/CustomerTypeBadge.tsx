/**
 * One token-mapped Badge per backend customer type (CUST-03, D-06). The
 * label ALWAYS comes from i18n — raw enum strings never reach the DOM. The
 * style map is typed Record<CustomerType, string>, so a new backend type
 * value fails tsc (the repo's DTO drift-detection idiom, mirroring
 * fleet/StatusBadge.tsx).
 */
import { useTranslation } from "react-i18next";
import type { CustomerType } from "@/types/customer";
import { Badge } from "@/shared/ui/badge";

const typeStyles: Record<CustomerType, string> = {
  individual: "bg-primary/10 text-primary",
  company: "border-border text-muted-foreground",
};

export function CustomerTypeBadge({ type }: { type: CustomerType }) {
  const { t } = useTranslation();
  return (
    <Badge variant="outline" className={typeStyles[type]}>
      {t(`customers.type.${type}`)}
    </Badge>
  );
}
