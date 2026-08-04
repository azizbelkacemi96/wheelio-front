/**
 * Expiring-documents alert (Phase 8) — shown on the "today" dashboard. Lists
 * vehicle documents (insurance / contrôle technique / carte grise) expiring
 * within N days, each linking to its vehicle. Renders nothing when the feed is
 * empty so it stays out of the way until something actually needs attention.
 */
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { useLocale } from "@/shared/i18n/useLocale";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { PlateBadge } from "@/shared/ui/plate-badge";
import { useExpiringDocumentsQuery } from "./queries";

export function ExpiringDocumentsCard({ withinDays = 30 }: { withinDays?: number }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const query = useExpiringDocumentsQuery(withinDays);
  const items = query.data ?? [];

  // Silent until there's something to warn about (or while loading/erroring).
  if (query.isPending || query.isError || items.length === 0) return null;

  const isExpired = (d?: string) =>
    d ? new Date(`${d}T00:00:00`).getTime() < Date.now() : false;

  return (
    <Card className="border-amber-500/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="size-4" aria-hidden={true} />
          {t("documents.expiring.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y divide-border">
          {items.map((item) => (
            <li
              key={item.document.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <div className="flex items-center gap-2">
                <Link
                  to="/vehicules/$vehicleId"
                  params={{ vehicleId: item.document.vehicle_id }}
                  className="inline-flex hover:opacity-80"
                >
                  <PlateBadge plate={item.registration_plate} />
                </Link>
                <span className="text-sm text-foreground">
                  {t(`documents.docType.${item.document.type}`)}
                </span>
              </div>
              <Badge variant={isExpired(item.document.expires_at) ? "destructive" : "outline"}>
                {item.document.expires_at
                  ? isExpired(item.document.expires_at)
                    ? t("documents.expired")
                    : t("documents.expiresOn", {
                        date: new Date(
                          `${item.document.expires_at}T00:00:00`,
                        ).toLocaleDateString(locale),
                      })
                  : ""}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
