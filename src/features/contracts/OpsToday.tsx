/**
 * OPS-01 — the "today" overview on the `/` landing. Consumes 04-01's
 * useTodayOverviewQuery (the useQueries fan-out + Africa/Algiers filtering);
 * this screen only resolves names (via useCustomersQuery + resolve.ts) and
 * renders. Pickups = reserved starting today; returns = active ending today.
 * Both-empty → ops.emptyAll.
 */
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import {
  BellRing,
  Car,
  CircleCheck,
  Coins,
  KeyRound,
  Percent,
  Wallet,
  Wrench,
} from "lucide-react";
import { useLocale } from "@/shared/i18n/useLocale";
import { isOrgAdmin } from "@/shared/auth/permissions";
import { useAuthStore } from "@/shared/auth/store";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { StatCard } from "@/shared/ui/stat-card";
import { RentalScene } from "@/shared/ui/illustrations";
import { useCustomersQuery } from "@/features/customers/queries";
import { ExpiringDocumentsCard } from "@/features/documents/ExpiringDocumentsCard";
import { useDashboardQuery } from "@/features/dashboard/queries";
import { OnboardingChecklist } from "@/features/dashboard/OnboardingChecklist";
import { useTodayOverviewQuery } from "./queries";
import { byId, toContractView, type ContractView } from "./resolve";

export function OpsToday() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const scope = useAuthStore((s) => s.scope);
  const overview = useTodayOverviewQuery();
  const customersQuery = useCustomersQuery("");
  const dashboard = useDashboardQuery();

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

  const stats = dashboard.data;
  const formatDzd = (cents: number) => `${(cents / 100).toLocaleString(locale)} DZD`;

  const nothing = pickups.length === 0 && returns.length === 0;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Hero band with a rental scene so the landing feels warm, not bare. */}
      <div className="relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/15 via-primary/5 to-teal-500/10 p-6">
        <div
          className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-teal-400/15 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold text-foreground">{t("ops.title")}</h1>
          <p className="max-w-md text-sm text-muted-foreground">{t("ops.subtitle")}</p>
        </div>
        <RentalScene className="relative hidden h-28 w-48 shrink-0 drop-shadow-sm sm:block" />
      </div>

      {/* First-run setup guidance — admins only, hides itself once complete. */}
      {stats && scope && isOrgAdmin(scope) && <OnboardingChecklist setup={stats.setup} />}

      {/* KPI figures at a glance. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Car} label={t("ops.stats.fleet")} value={stats ? stats.vehicles.total : "…"} tone="primary" />
        <StatCard icon={CircleCheck} label={t("ops.stats.available")} value={stats ? stats.vehicles.available : "…"} tone="success" />
        <StatCard icon={KeyRound} label={t("ops.stats.rented")} value={stats ? stats.vehicles.rented : "…"} />
        <StatCard icon={Percent} label={t("ops.stats.utilization")} value={stats ? `${stats.utilization_pct}%` : "…"} tone="primary" />
        <StatCard icon={Wallet} label={t("ops.stats.revenue")} value={stats ? formatDzd(stats.revenue_month_ttc_cents) : "…"} tone="success" />
        <StatCard icon={Coins} label={t("ops.stats.deposits")} value={stats ? formatDzd(stats.deposits_held_cents) : "…"} />
        <StatCard icon={Wrench} label={t("ops.stats.maintenance")} value={stats ? stats.vehicles.maintenance : "…"} tone="warning" />
        <StatCard
          icon={BellRing}
          label={t("ops.stats.expiring")}
          value={stats ? stats.expiring_documents : "…"}
          tone={stats && stats.expiring_documents > 0 ? "warning" : "default"}
        />
      </div>

      {/* Phase 8: expiring vehicle documents (assurance/CT) — silent when none. */}
      <ExpiringDocumentsCard />

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
