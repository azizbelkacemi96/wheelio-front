/**
 * /etats-des-lieux landing (INSP entry topology, 05-RESEARCH.md). There is no
 * "list inspections" endpoint, and inspections are decoupled from contract
 * status — so this index lists the contracts an inspection can be run against
 * (reserved or active) and links each into the contract-scoped capture screen.
 *
 * Composed CLIENT-SIDE exactly like ContractList/OPS-01: `useAllContractsQuery`
 * fans out per-vehicle, and plate/customer are joined in-memory via resolve.ts
 * (`byId` + `toContractView`) over the vehicles + a one-shot customers list.
 * agency_id is NEVER read off a contract; the capture screen fetches the
 * vehicle for the canOperate gate.
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale } from "@/shared/i18n/useLocale";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { EmptyState } from "@/shared/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { ContractStatusBadge } from "@/features/contracts/ContractStatusBadge";
import { useAllContractsQuery } from "@/features/contracts/queries";
import { byId, toContractView, type ContractView } from "@/features/contracts/resolve";
import { useCustomersQuery } from "@/features/customers/queries";

export function InspectionsIndex() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const queryClient = useQueryClient();

  const all = useAllContractsQuery();
  const customersQuery = useCustomersQuery("");
  const customers = customersQuery.data ?? [];

  const isPending = all.isPending || customersQuery.isPending;
  const isError = all.isError || customersQuery.isError;

  const vehicleMap = useMemo(() => byId(all.vehicles), [all.vehicles]);
  const customerMap = useMemo(() => byId(customers), [customers]);

  // Only reserved/active contracts are inspectable (closed/cancelled are done).
  const views = useMemo(
    () =>
      all.contracts
        .filter((c) => c.status === "reserved" || c.status === "active")
        .map((c) => toContractView(c, vehicleMap, customerMap)),
    [all.contracts, vehicleMap, customerMap],
  );

  const formatPeriod = (startsAt: string, endsAt: string) =>
    `${new Date(startsAt).toLocaleDateString(locale)} – ${new Date(endsAt).toLocaleDateString(locale)}`;

  const handleRetry = () => {
    void queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    void queryClient.invalidateQueries({ queryKey: ["contracts"] });
    void queryClient.invalidateQueries({ queryKey: ["customers"] });
  };

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-semibold text-foreground">
          {t("inspections.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("inspections.index.subtitle")}</p>
      </header>

      <IndexBody
        isPending={isPending}
        isError={isError}
        onRetry={handleRetry}
        views={views}
        formatPeriod={formatPeriod}
      />
    </div>
  );
}

function IndexBody({
  isPending,
  isError,
  onRetry,
  views,
  formatPeriod,
}: {
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  views: ContractView[];
  formatPeriod: (startsAt: string, endsAt: string) => string;
}) {
  const { t } = useTranslation();

  if (isPending) return <IndexSkeleton />;

  if (isError) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-border p-4" role="alert">
        <p className="text-sm text-destructive">{t("inspections.index.loadError")}</p>
        <Button onClick={onRetry}>{t("inspections.index.retry")}</Button>
      </div>
    );
  }

  if (views.length === 0) {
    return (
      <EmptyState
        titleKey="inspections.index.empty.heading"
        descriptionKey="inspections.index.empty.body"
        car
      />
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-3 py-2">{t("inspections.index.columns.vehicle")}</TableHead>
              <TableHead className="px-3 py-2">{t("inspections.index.columns.customer")}</TableHead>
              <TableHead className="px-3 py-2">{t("inspections.index.columns.period")}</TableHead>
              <TableHead className="px-3 py-2">{t("inspections.index.columns.status")}</TableHead>
              <TableHead className="px-3 py-2" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {views.map((v) => (
              <TableRow key={v.contract.id}>
                <TableCell className="px-3 py-2 font-medium">{v.plate ?? "—"}</TableCell>
                <TableCell className="px-3 py-2">{v.customerName ?? "—"}</TableCell>
                <TableCell className="px-3 py-2">
                  {formatPeriod(v.contract.starts_at, v.contract.ends_at)}
                </TableCell>
                <TableCell className="px-3 py-2">
                  <ContractStatusBadge status={v.contract.status} />
                </TableCell>
                <TableCell className="px-3 py-2 text-right">
                  <Button asChild size="sm" variant="outline">
                    <Link to="/etats-des-lieux/$contractId" params={{ contractId: v.contract.id }}>
                      {t("inspections.index.open")}
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {views.map((v) => (
          <Card key={v.contract.id} size="sm">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>{v.plate ?? "—"}</CardTitle>
              <ContractStatusBadge status={v.contract.status} />
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
              <span className="text-foreground">{v.customerName ?? "—"}</span>
              <span>{formatPeriod(v.contract.starts_at, v.contract.ends_at)}</span>
              <Button asChild size="sm" variant="outline" className="self-start">
                <Link to="/etats-des-lieux/$contractId" params={{ contractId: v.contract.id }}>
                  {t("inspections.index.open")}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function IndexSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          {Array.from({ length: 5 }).map((__, j) => (
            <Skeleton key={j} className="h-6 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
