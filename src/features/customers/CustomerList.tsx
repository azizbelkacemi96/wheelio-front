/**
 * Customer list screen (CUST-03, D-01/D-06).
 *
 * UNLIKE fleet's client-side text filter (02-02), search here is
 * SERVER-side (03-01/03-RESEARCH.md D-04): the backend's GET /customers?q=
 * IS the search, so the typed term is debounced (~300ms) into the
 * `useCustomersQuery(q)` cache key — the query key itself is the source of
 * truth, not a client-side useMemo filter over an already-fetched array.
 *
 * Responsive per D-01: a dense <table> on md+ and a stacked <Card> list
 * below md. Both are always in the DOM (CSS controls visibility) because
 * jsdom can't evaluate media queries. Every visible string flows through
 * i18n (D-06); the only bare literals are raw data values (name, phone,
 * identity numbers).
 *
 * Read/search only: no `currentAgencyId` read (customers are org-scoped,
 * 03-01). The header exposes a "New customer" link to `/clients/nouveau`
 * (create form lives in 03-03), gated with `hasOrgRole(scope, "agent")` —
 * the same org-wide gate `CustomerCreateForm` itself enforces — so
 * unauthorized users never see a dead-end CTA (review CR-01).
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import type { CustomerResponse } from "@/types/customer";
import { useAuthStore } from "@/shared/auth/store";
import { hasOrgRole } from "@/shared/auth/permissions";
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
import { CustomerTypeBadge } from "./CustomerTypeBadge";
import { useCustomersQuery } from "./queries";

/** Debounce delay (ms) before a keystroke becomes a new ?q= request
 * (research Open Question 1 recommendation — avoids one request/keystroke). */
const SEARCH_DEBOUNCE_MS = 300;

/** company -> legal_name, individual -> full_name (research "Type display helper"). */
function customerDisplayName(c: CustomerResponse): string {
  return c.type === "company" ? (c.legal_name ?? "") : (c.full_name ?? "");
}

/** identity column: rc for companies, identity_doc_number for individuals —
 * both omitempty, so presence-guarded at the call site. */
function customerIdentityValue(c: CustomerResponse): string | undefined {
  return c.type === "company" ? c.rc : c.identity_doc_number;
}

export function CustomerList() {
  const { t } = useTranslation();
  const scope = useAuthStore((s) => s.scope);
  const canCreate = scope !== null && hasOrgRole(scope, "agent");

  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => setQ(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [search]);

  const query = useCustomersQuery(q);
  const customers = query.data ?? [];

  const isSearchActive = q.trim() !== "";
  // Controls stay mounted whenever a search is active, even if it currently
  // matches nothing — otherwise typing a zero-result term would unmount the
  // very Input holding that term, stranding the user with no way to clear it
  // (mirrors fleet VehicleList CR-01). Only a genuinely empty org (no search)
  // hides them.
  //
  // Gated on `!query.isPending`, NOT `query.isSuccess`: with
  // `placeholderData: keepPreviousData` (queries.ts), `isPending` is true
  // ONLY on the very first load — every subsequent debounced search term
  // keeps the previous result set (and a non-pending status) visible while
  // the new request resolves in the background. Gating on `isSuccess`
  // instead would flip these to `false` on nearly every completed debounce
  // cycle (a query key that has never been fetched starts `pending`),
  // unmounting the very Input holding the user's search text (review CR-02).
  const showControls = !query.isPending && (customers.length > 0 || isSearchActive);
  const showCount = !query.isPending && customers.length > 0;

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-heading text-xl font-semibold text-foreground">
            {t("customers.title")}
          </h1>
          {canCreate && (
            <Button asChild>
              <Link to="/clients/nouveau">{t("customers.create.cta")}</Link>
            </Button>
          )}
        </div>
        {showCount && (
          <p className="text-sm text-muted-foreground">
            {t("customerCount", { count: customers.length })}
          </p>
        )}
      </header>

      {showControls && (
        <Input
          type="search"
          aria-label={t("customers.searchPlaceholder")}
          placeholder={t("customers.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
      )}

      <CustomerListBody query={query} customers={customers} isSearchActive={isSearchActive} />
    </div>
  );
}

interface BodyProps {
  query: ReturnType<typeof useCustomersQuery>;
  customers: CustomerResponse[];
  isSearchActive: boolean;
}

function CustomerListBody({ query, customers, isSearchActive }: BodyProps) {
  const { t } = useTranslation();

  if (query.isPending) return <CustomerListSkeleton />;

  if (query.isError) {
    return (
      <div
        className="flex flex-col items-start gap-3 rounded-lg border border-border p-4"
        role="alert"
      >
        <p className="text-sm text-destructive">{t("customers.loadError")}</p>
        <Button onClick={() => query.refetch()}>{t("customers.retry")}</Button>
      </div>
    );
  }

  // True-empty org ONLY when nothing is searched. A zero-row result while a
  // search is active is "no matches", not "no customers".
  if (customers.length === 0 && !isSearchActive) {
    return (
      <EmptyState
        titleKey="customers.empty.heading"
        descriptionKey="customers.empty.body"
      />
    );
  }

  if (customers.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("customers.noResults")}
      </p>
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <CustomerTable customers={customers} />
      </div>
      <div className="flex flex-col gap-3 md:hidden" data-testid="customer-card-stack">
        {customers.map((c) => (
          <CustomerCard key={c.id} customer={c} />
        ))}
      </div>
    </>
  );
}

function CustomerTable({ customers }: { customers: CustomerResponse[] }) {
  const { t } = useTranslation();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="px-3 py-2">{t("customers.columns.name")}</TableHead>
          <TableHead className="px-3 py-2">{t("customers.columns.type")}</TableHead>
          <TableHead className="px-3 py-2">{t("customers.columns.identityDoc")}</TableHead>
          <TableHead className="px-3 py-2">{t("customers.columns.phone")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {customers.map((c) => {
          const identityValue = customerIdentityValue(c);
          return (
            <TableRow key={c.id}>
              <TableCell className="px-3 py-2 font-medium">
                <Link
                  to="/clients/$customerId"
                  params={{ customerId: c.id }}
                  className="text-primary hover:underline"
                >
                  {customerDisplayName(c)}
                </Link>
              </TableCell>
              <TableCell className="px-3 py-2">
                <CustomerTypeBadge type={c.type} />
              </TableCell>
              <TableCell className="px-3 py-2">{identityValue ?? "—"}</TableCell>
              <TableCell className="px-3 py-2">{c.phone ?? "—"}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function CustomerCard({ customer }: { customer: CustomerResponse }) {
  const { t } = useTranslation();
  const identityValue = customerIdentityValue(customer);
  return (
    <Card size="sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>
          <Link
            to="/clients/$customerId"
            params={{ customerId: customer.id }}
            className="text-primary hover:underline"
          >
            {customerDisplayName(customer)}
          </Link>
        </CardTitle>
        <CustomerTypeBadge type={customer.type} />
      </CardHeader>
      <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
        {identityValue && (
          <span>
            {t("customers.columns.identityDoc")}: {identityValue}
          </span>
        )}
        {customer.phone && <span>{customer.phone}</span>}
      </CardContent>
    </Card>
  );
}

function CustomerListSkeleton() {
  const columns = 4;
  return (
    <div className="flex flex-col gap-2" data-testid="customer-list-loading">
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
