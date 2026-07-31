/**
 * OPS-01 — the "today" overview on the `/` landing. Consumes 04-01's
 * useTodayOverviewQuery (the useQueries fan-out + Africa/Algiers filtering);
 * this screen only resolves names (via useCustomersQuery + resolve.ts) and
 * renders. Pickups = reserved starting today; returns = active ending today.
 * Both-empty → ops.emptyAll.
 */
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { useLocale } from "@/shared/i18n/useLocale";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { useCustomersQuery } from "@/features/customers/queries";
import { useTodayOverviewQuery } from "./queries";
import { byId, toContractView, type ContractView } from "./resolve";

export function OpsToday() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const overview = useTodayOverviewQuery();
  const customersQuery = useCustomersQuery("");

  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  if (overview.isPending) {
    return (
      <div className="flex flex-col gap-4 p-4 md:p-6" data-testid="ops-loading">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (overview.isError) {
    return (
      <div className="flex flex-col items-start gap-3 p-4 md:p-6" role="alert">
        <p className="text-sm text-destructive">{t("contracts.loadError")}</p>
        <Button onClick={() => window.location.reload()}>{t("contracts.retry")}</Button>
      </div>
    );
  }

  const vehiclesById = byId(overview.vehicles);
  const customersById = byId(customersQuery.data ?? []);
  const pickups = overview.pickups.map((c) => toContractView(c, vehiclesById, customersById));
  const returns = overview.returns.map((c) => toContractView(c, vehiclesById, customersById));

  const nothing = pickups.length === 0 && returns.length === 0;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="font-heading text-xl font-semibold text-foreground">{t("ops.title")}</h1>

      {nothing ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("ops.emptyAll")}</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <OpsSection
            title={t("ops.pickups.title")}
            emptyLabel={t("ops.pickups.empty")}
            rows={pickups}
            timeOf={(v) => time(v.contract.starts_at)}
          />
          <OpsSection
            title={t("ops.returns.title")}
            emptyLabel={t("ops.returns.empty")}
            rows={returns}
            timeOf={(v) => time(v.contract.ends_at)}
          />
        </div>
      )}
    </div>
  );
}

function OpsSection({
  title,
  emptyLabel,
  rows,
  timeOf,
}: {
  title: string;
  emptyLabel: string;
  rows: ContractView[];
  timeOf: (v: ContractView) => string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((v) => (
            <li key={v.contract.id}>
              <Link
                to="/contrats/$contractId"
                params={{ contractId: v.contract.id }}
                className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 hover:bg-muted"
              >
                <span className="flex flex-col">
                  <span className="font-medium text-foreground">{v.plate ?? "—"}</span>
                  <span className="text-sm text-muted-foreground">{v.customerName ?? "—"}</span>
                </span>
                <span className="text-sm tabular-nums text-muted-foreground">{timeOf(v)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
