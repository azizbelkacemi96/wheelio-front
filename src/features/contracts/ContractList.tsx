/**
 * Contract list screen (RENT-01..04, D-02).
 *
 * The list is COMPOSED CLIENT-SIDE: there is no list-all endpoint
 * (04-RESEARCH.md reality #1). `useAllContractsQuery` (04-01) reads the
 * vehicles list then fans out one per-vehicle rental-contracts request and
 * returns the flattened contracts PLUS the vehicles array for the join. This
 * screen MUST NOT call any GET /contracts endpoint.
 *
 * `contractResponse` carries only UUIDs (vehicle_id / customer_id) — no plate,
 * no customer name, no agency_id. Plate/customer are joined in-memory via
 * resolve.ts (`byId` + `toContractView`) over the vehicles from the
 * composition and a one-shot customers list (`useCustomersQuery("")`). A
 * contract whose vehicle or customer can't be resolved renders an em dash and
 * never crashes — and agency_id is NEVER read off a contract.
 *
 * BOTH the status filter and the text search are CLIENT-side useMemos over the
 * already-composed array (the whole set is in memory — unlike CustomerList's
 * server-side ?q=, a debounced round-trip is neither possible nor needed).
 *
 * Responsive per D-02: a dense <table> on md+ and a stacked <Card> list below
 * md, both always in the DOM (CSS controls visibility) because jsdom can't
 * evaluate media queries. Every visible string flows through i18n; the only
 * bare literals are raw data (plate, customer name) and the em-dash fallback.
 *
 * The "New contract" CTA is gated on `hasOrgRole(scope, "agent")` — the /contrats
 * list has no agency context yet, so it uses the org-wide "agent in SOME agency"
 * gate; the wizard (04-04) narrows per-vehicle and the backend re-enforces
 * create authz with its own 403 (T-04-06, UX-only gate).
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/shared/auth/store";
import { hasOrgRole } from "@/shared/auth/permissions";
import { useLocale } from "@/shared/i18n/useLocale";
import type { ContractStatus } from "@/types/rental";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { useCustomersQuery } from "@/features/customers/queries";
import { ContractStatusBadge } from "./ContractStatusBadge";
import { useAllContractsQuery } from "./queries";
import { byId, toContractView, type ContractView } from "./resolve";

/** The four backend statuses, in display order (exhaustive over the union). */
const CONTRACT_STATUSES: readonly ContractStatus[] = [
  "reserved",
  "active",
  "closed",
  "cancelled",
];

/** Sentinel for the "all statuses" option — Radix Select forbids an empty
 * string value, so `null` status is represented as this literal in the UI. */
const ALL_STATUSES = "all";

export function ContractList() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const scope = useAuthStore((s) => s.scope);
  const canCreate = scope !== null && hasOrgRole(scope, "agent");

  const [status, setStatus] = useState<ContractStatus | null>(null);
  const [search, setSearch] = useState("");

  const all = useAllContractsQuery();
  const customersQuery = useCustomersQuery("");
  const customers = customersQuery.data ?? [];

  const isPending = all.isPending || customersQuery.isPending;
  const isError = all.isError || customersQuery.isError;

  const vehicleMap = useMemo(() => byId(all.vehicles), [all.vehicles]);
  const customerMap = useMemo(() => byId(customers), [customers]);

  const views = useMemo(
    () => all.contracts.map((c) => toContractView(c, vehicleMap, customerMap)),
    [all.contracts, vehicleMap, customerMap],
  );

  const formatPeriod = (startsAt: string, endsAt: string) =>
    `${new Date(startsAt).toLocaleDateString(locale)} – ${new Date(endsAt).toLocaleDateString(locale)}`;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return views.filter((v) => {
      if (status !== null && v.contract.status !== status) return false;
      if (!term) return true;
      const plate = v.plate?.toLowerCase() ?? "";
      const name = v.customerName?.toLowerCase() ?? "";
      return plate.includes(term) || name.includes(term);
    });
  }, [views, status, search]);

  const isFilterActive = status !== null || search.trim() !== "";
  // Controls stay mounted whenever a filter is active, even if it currently
  // matches nothing — otherwise selecting a zero-result status would unmount
  // the very Select holding that filter, stranding the user with no way to
  // clear it (Phase 2 CR-01). Only a genuinely empty set (no filter) hides them.
  const showControls = !isPending && !isError && (views.length > 0 || isFilterActive);

  const handleRetry = () => {
    void queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    void queryClient.invalidateQueries({ queryKey: ["contracts"] });
    void queryClient.invalidateQueries({ queryKey: ["customers"] });
  };

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-heading text-xl font-semibold text-foreground">
            {t("contracts.title")}
          </h1>
          {canCreate && (
            <Button asChild>
              <Link to="/contrats/nouveau">{t("contracts.actions.new")}</Link>
            </Button>
          )}
        </div>
      </header>

      {showControls && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            type="search"
            aria-label={t("contracts.searchPlaceholder")}
            placeholder={t("contracts.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs"
          />
          <Select
            value={status ?? ALL_STATUSES}
            onValueChange={(value) =>
              setStatus(value === ALL_STATUSES ? null : (value as ContractStatus))
            }
          >
            <SelectTrigger
              aria-label={t("contracts.columns.status")}
              className="sm:w-56"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUSES}>
                {t("contracts.filter.all")}
              </SelectItem>
              {CONTRACT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`contracts.filter.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <ContractListBody
        isPending={isPending}
        isError={isError}
        onRetry={handleRetry}
        totalCount={views.length}
        filtered={filtered}
        isFilterActive={isFilterActive}
        formatPeriod={formatPeriod}
      />
    </div>
  );
}

interface BodyProps {
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  totalCount: number;
  filtered: ContractView[];
  isFilterActive: boolean;
  formatPeriod: (startsAt: string, endsAt: string) => string;
}

function ContractListBody({
  isPending,
  isError,
  onRetry,
  totalCount,
  filtered,
  isFilterActive,
  formatPeriod,
}: BodyProps) {
  const { t } = useTranslation();

  if (isPending) return <ContractListSkeleton />;

  if (isError) {
    return (
      <div
        className="flex flex-col items-start gap-3 rounded-lg border border-border p-4"
        role="alert"
      >
        <p className="text-sm text-destructive">{t("contracts.loadError")}</p>
        <Button onClick={onRetry}>{t("contracts.retry")}</Button>
      </div>
    );
  }

  // True-empty ONLY when nothing is filtered. A zero-row result while a
  // status/search filter is active is "no matches", not "no contracts" (CR-01).
  if (totalCount === 0 && !isFilterActive) {
    return (
      <EmptyState
        titleKey="contracts.empty.heading"
        descriptionKey="contracts.empty.body"
        car
      />
    );
  }

  if (filtered.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("contracts.noResults")}
      </p>
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <ContractTable views={filtered} formatPeriod={formatPeriod} />
      </div>
      <div className="flex flex-col gap-3 md:hidden" data-testid="contract-card-stack">
        {filtered.map((v) => (
          <ContractCard key={v.contract.id} view={v} formatPeriod={formatPeriod} />
        ))}
      </div>
    </>
  );
}

interface RowsProps {
  views: ContractView[];
  formatPeriod: (startsAt: string, endsAt: string) => string;
}

function ContractTable({ views, formatPeriod }: RowsProps) {
  const { t } = useTranslation();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="px-3 py-2">{t("contracts.columns.vehicle")}</TableHead>
          <TableHead className="px-3 py-2">{t("contracts.columns.customer")}</TableHead>
          <TableHead className="px-3 py-2">{t("contracts.columns.period")}</TableHead>
          <TableHead className="px-3 py-2">{t("contracts.columns.status")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {views.map((v) => (
          <TableRow key={v.contract.id}>
            <TableCell className="px-3 py-2 font-medium">
              <Link
                to="/contrats/$contractId"
                params={{ contractId: v.contract.id }}
                className="text-primary hover:underline"
              >
                {v.plate ?? "—"}
              </Link>
            </TableCell>
            <TableCell className="px-3 py-2">{v.customerName ?? "—"}</TableCell>
            <TableCell className="px-3 py-2">
              {formatPeriod(v.contract.starts_at, v.contract.ends_at)}
            </TableCell>
            <TableCell className="px-3 py-2">
              <ContractStatusBadge status={v.contract.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ContractCard({
  view,
  formatPeriod,
}: {
  view: ContractView;
  formatPeriod: (startsAt: string, endsAt: string) => string;
}) {
  const { t } = useTranslation();
  return (
    <Card size="sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>
          <Link
            to="/contrats/$contractId"
            params={{ contractId: view.contract.id }}
            className="text-primary hover:underline"
          >
            {view.plate ?? "—"}
          </Link>
        </CardTitle>
        <ContractStatusBadge status={view.contract.status} />
      </CardHeader>
      <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
        <span className="text-foreground">{view.customerName ?? "—"}</span>
        <span>
          {t("contracts.columns.period")}:{" "}
          {formatPeriod(view.contract.starts_at, view.contract.ends_at)}
        </span>
      </CardContent>
    </Card>
  );
}

function ContractListSkeleton() {
  const columns = 4;
  return (
    <div className="flex flex-col gap-2" data-testid="contract-list-loading">
      {Array.from({ length: 6 }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-3">
          {Array.from({ length: columns }).map((__, colIdx) => (
            <Skeleton key={colIdx} className="h-6 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
