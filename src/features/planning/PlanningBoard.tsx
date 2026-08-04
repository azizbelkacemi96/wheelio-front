/**
 * Fleet planning (PLAN-01) — a read-only timeline: one row per vehicle, bookings
 * and unavailability drawn as bars over a week/month window. Data comes from GET
 * /planning (one org-scoped aggregate); customer names resolve from the shared
 * customers query. Bars are positioned by their fraction of the window; the
 * backend's EXCLUDE constraint guarantees no two bars on a vehicle overlap.
 * Clicking a booking bar opens the contract.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/useLocale";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { EmptyState } from "@/shared/ui/empty-state";
import { PlateBadge } from "@/shared/ui/plate-badge";
import { useCustomersQuery } from "@/features/customers/queries";
import { usePlanningQuery } from "./queries";
import type { PlanningBooking, PlanningUnavailability } from "@/types/planning";

const DAY = 86_400_000;
type View = "week" | "month";

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfWeek = (d: Date) => addDays(d, -((d.getDay() + 6) % 7)); // Monday
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const daysInMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

const STATUS_BAR: Record<string, string> = {
  reserved: "bg-amber-400 text-amber-950 hover:bg-amber-500",
  active: "bg-primary text-primary-foreground hover:brightness-110",
  closed: "bg-slate-300 text-slate-700 hover:bg-slate-400 dark:bg-slate-600 dark:text-slate-100",
};

export function PlanningBoard() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(() => new Date());

  const windowStart = view === "week" ? startOfWeek(anchor) : startOfMonth(anchor);
  const days = view === "week" ? 7 : daysInMonth(anchor);
  const from = ymd(windowStart);
  const to = ymd(addDays(windowStart, days));

  const planning = usePlanningQuery(from, to);
  const customersQuery = useCustomersQuery("");

  const customerName = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of customersQuery.data ?? []) {
      map.set(c.id, c.legal_name ?? c.full_name ?? "—");
    }
    return (id: string) => map.get(id) ?? "—";
  }, [customersQuery.data]);

  const startMs = new Date(windowStart.getFullYear(), windowStart.getMonth(), windowStart.getDate()).getTime();
  const spanMs = days * DAY;
  const span = (isoStart: string, isoEnd: string) => {
    const left = clamp01((new Date(isoStart).getTime() - startMs) / spanMs);
    const right = clamp01((new Date(isoEnd).getTime() - startMs) / spanMs);
    return { left, width: Math.max(right - left, 0) };
  };

  const shift = (dir: -1 | 1) =>
    setAnchor((a) =>
      view === "week"
        ? addDays(a, dir * 7)
        : new Date(a.getFullYear(), a.getMonth() + dir, 1),
    );

  const rangeLabel =
    view === "week"
      ? `${windowStart.toLocaleDateString(locale, { day: "numeric", month: "short" })} – ${addDays(windowStart, 6).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}`
      : windowStart.toLocaleDateString(locale, { month: "long", year: "numeric" });

  const dayCells = Array.from({ length: days }, (_, i) => addDays(windowStart, i));

  const bookingsByVehicle = groupBy(planning.data?.bookings ?? [], (b) => b.vehicle_id);
  const unavailByVehicle = groupBy(planning.data?.unavailability ?? [], (u) => u.vehicle_id);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold text-foreground">{t("planning.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("planning.subtitle")}</p>
      </header>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-border p-0.5">
          {(["week", "month"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`planning.view.${v}`)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" aria-label={t("planning.prev")} onClick={() => shift(-1)}>
            <ChevronLeft className="size-4" aria-hidden={true} />
          </Button>
          <span className="min-w-40 text-center text-sm font-medium text-foreground">{rangeLabel}</span>
          <Button variant="outline" size="icon-sm" aria-label={t("planning.next")} onClick={() => shift(1)}>
            <ChevronRight className="size-4" aria-hidden={true} />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
            {t("planning.today")}
          </Button>
        </div>
      </div>

      <Legend />

      {planning.isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : planning.isError ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-border p-4" role="alert">
          <p className="text-sm text-destructive">{t("planning.loadError")}</p>
          <Button onClick={() => planning.refetch()}>{t("planning.retry")}</Button>
        </div>
      ) : (planning.data?.vehicles.length ?? 0) === 0 ? (
        <EmptyState titleKey="planning.emptyHeading" descriptionKey="planning.emptyBody" car />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <div className="min-w-[720px]">
            {/* Day header */}
            <div className="flex border-b border-border bg-muted/40">
              <div className="w-44 shrink-0 border-r border-border px-3 py-2 text-xs font-medium text-muted-foreground">
                {t("planning.vehicle")}
              </div>
              <div className="relative flex flex-1">
                {dayCells.map((d, i) => {
                  const weekend = d.getDay() === 0 || d.getDay() === 6;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "flex-1 border-r border-border/60 px-1 py-2 text-center text-[11px] last:border-r-0",
                        weekend ? "bg-muted/60 text-muted-foreground" : "text-foreground",
                      )}
                    >
                      {view === "week" ? (
                        <div className="flex flex-col leading-tight">
                          <span>{d.toLocaleDateString(locale, { weekday: "short" })}</span>
                          <span className="font-semibold">{d.getDate()}</span>
                        </div>
                      ) : (
                        d.getDate()
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Vehicle rows */}
            {planning.data!.vehicles.map((v) => {
              const bookings = bookingsByVehicle.get(v.id) ?? [];
              const unavail = unavailByVehicle.get(v.id) ?? [];
              return (
                <div key={v.id} className="flex border-b border-border last:border-b-0">
                  <div className="flex w-44 shrink-0 flex-col justify-center gap-1 border-r border-border px-3 py-2">
                    <PlateBadge plate={v.registration_plate} className="text-xs" />
                    <span className="truncate text-xs text-muted-foreground">
                      {v.brand} {v.model}
                    </span>
                  </div>
                  <div className="relative h-12 flex-1">
                    {/* day gridlines */}
                    {dayCells.map((d, i) => (
                      <div
                        key={i}
                        className={cn(
                          "absolute inset-y-0 border-r border-border/40",
                          (d.getDay() === 0 || d.getDay() === 6) && "bg-muted/30",
                        )}
                        style={{ left: `${(i / days) * 100}%`, width: `${(1 / days) * 100}%` }}
                      />
                    ))}
                    {unavail.map((u) => (
                      <UnavailBar key={u.id} u={u} span={span} label={t(`planning.reason.${u.reason}`, u.reason)} />
                    ))}
                    {bookings.map((b) => (
                      <BookingBar
                        key={b.id}
                        b={b}
                        span={span}
                        customer={customerName(b.customer_id)}
                        statusLabel={t(`contracts.status.${b.status}`)}
                        locale={locale}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function BookingBar({
  b,
  span,
  customer,
  statusLabel,
  locale,
}: {
  b: PlanningBooking;
  span: (s: string, e: string) => { left: number; width: number };
  customer: string;
  statusLabel: string;
  locale: string;
}) {
  const { left, width } = span(b.starts_at, b.ends_at);
  if (width <= 0) return null;
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" });
  return (
    <Link
      to="/contrats/$contractId"
      params={{ contractId: b.id }}
      title={`${customer} · ${statusLabel} · ${fmt(b.starts_at)} → ${fmt(b.ends_at)}`}
      className={cn(
        "absolute top-1.5 flex h-9 items-center overflow-hidden rounded-md px-2 text-xs font-medium shadow-sm transition",
        STATUS_BAR[b.status] ?? STATUS_BAR.closed,
      )}
      style={{ left: `calc(${left * 100}% + 2px)`, width: `calc(${width * 100}% - 4px)` }}
    >
      <span className="truncate">{customer}</span>
    </Link>
  );
}

function UnavailBar({
  u,
  span,
  label,
}: {
  u: PlanningUnavailability;
  span: (s: string, e: string) => { left: number; width: number };
  label: string;
}) {
  const { left, width } = span(u.starts_at, u.ends_at);
  if (width <= 0) return null;
  return (
    <div
      title={label}
      className="absolute top-1.5 flex h-9 items-center overflow-hidden rounded-md border border-red-500/40 bg-red-400/70 px-2 text-xs font-medium text-red-950"
      style={{ left: `calc(${left * 100}% + 2px)`, width: `calc(${width * 100}% - 4px)` }}
    >
      <span className="truncate">{label}</span>
    </div>
  );
}

function Legend() {
  const { t } = useTranslation();
  const items: [string, string][] = [
    ["reserved", STATUS_BAR.reserved],
    ["active", STATUS_BAR.active],
    ["closed", STATUS_BAR.closed],
  ];
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      {items.map(([status, cls]) => (
        <span key={status} className="flex items-center gap-1.5">
          <span className={cn("size-3 rounded", cls.split(" ")[0])} />
          {t(`contracts.status.${status}`)}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded bg-red-400/70" />
        {t("planning.unavailable")}
      </span>
    </div>
  );
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = map.get(k);
    if (arr) arr.push(it);
    else map.set(k, [it]);
  }
  return map;
}
