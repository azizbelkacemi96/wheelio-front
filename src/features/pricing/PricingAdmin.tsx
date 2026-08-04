/**
 * "Tarification" — the org-admin pricing catalogue + a quote calculator.
 * Sections: a devis calculator (headline), vehicle classes, the per-class rate
 * grid (base + seasonal), and rate seasons. All writes are org-admin (backend
 * re-enforces; the UI gates on isOrgAdmin). Amounts are entered in whole DZD and
 * converted to cents at the boundary (the API is cents-only, never float).
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, Globe, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBookingSlug, setBookingSlug } from "@/features/booking/api";
import { isOrgAdmin } from "@/shared/auth/permissions";
import { useAuthStore } from "@/shared/auth/store";
import { useLocale } from "@/shared/i18n/useLocale";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import type {
  DepositRule,
  DiscountKind,
  ExtraCategory,
  ExtraPricingMode,
  QuoteResponse,
  RateDiscount,
  RatePlan,
  RateSeason,
  RentalExtra,
  VehicleClass,
} from "@/types/pricing";
import {
  createDepositRule,
  createRateDiscount,
  createRatePlan,
  createRateSeason,
  createRentalExtra,
  createVehicleClass,
  deleteDepositRule,
  deleteRateDiscount,
  deleteRatePlan,
  deleteRateSeason,
  deleteRentalExtra,
  deleteVehicleClass,
  previewQuote,
} from "./api";
import {
  CLASSES_KEY,
  DEPOSIT_RULES_KEY,
  DISCOUNTS_KEY,
  EXTRAS_KEY,
  SEASONS_KEY,
  useDepositRulesQuery,
  useRateDiscountsQuery,
  useRatePlansQuery,
  useRateSeasonsQuery,
  useRentalExtrasQuery,
  useVehicleClassesQuery,
} from "./queries";

const fieldCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function toCents(dzd: string): number {
  return Math.round(Number(dzd) * 100);
}

export function PricingAdmin() {
  const { t } = useTranslation();
  const scope = useAuthStore((s) => s.scope);
  const admin = !!scope && isOrgAdmin(scope);
  const [selectedClass, setSelectedClass] = useState<string>("");

  const classesQ = useVehicleClassesQuery(admin);
  const seasonsQ = useRateSeasonsQuery(admin);
  const extrasQ = useRentalExtrasQuery(admin);
  const discountsQ = useRateDiscountsQuery(admin);
  const depositRulesQ = useDepositRulesQuery(admin);

  if (!scope || !admin) {
    return (
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <EmptyState
          titleKey="pricing.notAuthorizedHeading"
          descriptionKey="pricing.notAuthorizedBody"
        />
      </div>
    );
  }

  const classes = classesQ.data ?? [];
  const seasons = seasonsQ.data ?? [];
  const extras = extrasQ.data ?? [];
  const discounts = discountsQ.data ?? [];
  const depositRules = depositRulesQ.data ?? [];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          {t("pricing.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("pricing.subtitle")}</p>
      </header>

      <BookingLinkSection />

      <QuoteCalculator classes={classes} extras={extras} />

      <ClassesSection
        classes={classes}
        selected={selectedClass}
        onSelect={setSelectedClass}
      />

      {selectedClass && (
        <RatePlansSection
          classId={selectedClass}
          className={classes.find((c) => c.id === selectedClass)?.name ?? ""}
          seasons={seasons}
        />
      )}

      <ExtrasSection extras={extras} />

      <DiscountsSection discounts={discounts} classes={classes} />

      <DepositRulesSection rules={depositRules} classes={classes} extras={extras} />

      <SeasonsSection seasons={seasons} />
    </div>
  );
}

// ---- Réservation en ligne (lien public) ----

function BookingLinkSection() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const slugQuery = useQuery({ queryKey: ["booking", "slug"], queryFn: getBookingSlug });
  const [slug, setSlug] = useState("");
  const [dirty, setDirty] = useState(false);

  const current = slugQuery.data?.slug ?? "";
  const value = dirty ? slug : current;

  const save = useMutation({
    mutationFn: () => setBookingSlug(value.trim()),
    onSuccess: () => {
      setDirty(false);
      void qc.invalidateQueries({ queryKey: ["booking", "slug"] });
    },
  });

  const publicUrl = current ? `${window.location.origin}/reserver/${current}` : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="size-5 text-primary" aria-hidden={true} />
          {t("booking.admin.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{t("booking.admin.help")}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t("booking.admin.slugLabel")}</span>
            <input
              className={fieldCls}
              value={value}
              placeholder="ma-societe"
              onChange={(e) => {
                setSlug(e.target.value);
                setDirty(true);
              }}
            />
          </label>
          <Button onClick={() => save.mutate()} disabled={value.trim() === "" || save.isPending}>
            {t("booking.admin.save")}
          </Button>
        </div>
        {save.isError && <p className="text-sm text-destructive">{t("booking.admin.error")}</p>}
        {publicUrl && (
          <div className="flex flex-col gap-1 rounded-lg border border-primary/25 bg-primary/5 p-3">
            <span className="text-xs text-muted-foreground">{t("booking.admin.publicLink")}</span>
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="truncate text-sm font-medium text-primary hover:underline"
            >
              {publicUrl}
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Devis ----

function QuoteCalculator({ classes, extras }: { classes: VehicleClass[]; extras: RentalExtra[] }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const [classId, setClassId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [quote, setQuote] = useState<QuoteResponse | null>(null);

  const dzd = (cents: number) => `${(cents / 100).toLocaleString(locale)} DZD`;
  const activeExtras = extras.filter((e) => e.active);

  const toggleExtra = (id: string) =>
    setSelectedExtras((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const mutation = useMutation({
    mutationFn: () =>
      previewQuote({
        class_id: classId,
        start_at: new Date(start).toISOString(),
        end_at: new Date(end).toISOString(),
        extra_ids: selectedExtras,
        discount_code: code.trim() || undefined,
      }),
    onSuccess: setQuote,
  });

  const canQuote = classId !== "" && start !== "" && end !== "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="size-5 text-primary" aria-hidden={true} />
          {t("pricing.quote.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t("pricing.fields.class")}</span>
            <select className={fieldCls} value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">{t("pricing.quote.pickClass")}</option>
              {classes
                .filter((c) => c.active)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t("pricing.quote.start")}</span>
            <input
              type="datetime-local"
              className={fieldCls}
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t("pricing.quote.end")}</span>
            <input
              type="datetime-local"
              className={fieldCls}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>

        {activeExtras.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted-foreground">{t("pricing.quote.extras")}</span>
            <div className="flex flex-wrap gap-2">
              {activeExtras.map((e) => {
                const on = selectedExtras.includes(e.id);
                return (
                  <button
                    type="button"
                    key={e.id}
                    onClick={() => toggleExtra(e.id)}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                      on
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {e.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <label className="flex flex-col gap-1 text-sm sm:max-w-xs">
          <span className="text-muted-foreground">{t("pricing.quote.code")}</span>
          <input
            className={fieldCls}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t("pricing.quote.codePlaceholder")}
          />
        </label>

        <div>
          <Button onClick={() => mutation.mutate()} disabled={!canQuote || mutation.isPending}>
            {t("pricing.quote.compute")}
          </Button>
        </div>

        {mutation.isError && (
          <p className="text-sm text-destructive">{t("pricing.quote.error")}</p>
        )}

        {quote && !mutation.isError && (
          <div className="flex flex-col gap-2 rounded-lg border border-primary/25 bg-primary/5 p-4">
            <Row label={t("pricing.quote.duration")} value={`${quote.duration_days} ${t("pricing.quote.days")}`} />
            {quote.season_name && (
              <Row label={t("pricing.quote.season")} value={quote.season_name} />
            )}
            <Row label={t("pricing.quote.rental")} value={dzd(quote.rental_cents)} />
            {quote.extras.map((line) => (
              <Row key={line.id} label={line.name} value={dzd(line.amount_cents)} />
            ))}
            {quote.discounts.length > 0 && (
              <>
                <Row label={t("pricing.quote.subtotal")} value={dzd(quote.subtotal_cents)} />
                {quote.discounts.map((line) => (
                  <Row
                    key={line.id}
                    label={line.name}
                    value={`− ${dzd(line.amount_cents)}`}
                    tone="discount"
                  />
                ))}
              </>
            )}
            <div className="my-1 h-px bg-border" />
            <Row label={t("pricing.quote.total")} value={dzd(quote.total_cents)} strong />
            <Row label={t("pricing.quote.deposit")} value={dzd(quote.deposit_cents)} />
            <p className="text-xs text-muted-foreground">{t("pricing.quote.vatNote")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "discount";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          strong ? "text-base font-semibold text-foreground" : "text-sm text-foreground",
          tone === "discount" && "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ---- Classes ----

function ClassesSection({
  classes,
  selected,
  onSelect,
}: {
  classes: VehicleClass[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [deposit, setDeposit] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createVehicleClass({
        name,
        display_order: classes.length,
        default_deposit_cents: deposit === "" ? null : toCents(deposit),
      }),
    onSuccess: () => {
      setName("");
      setDeposit("");
      void qc.invalidateQueries({ queryKey: CLASSES_KEY });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteVehicleClass(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: CLASSES_KEY }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pricing.classes.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {classes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("pricing.classes.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {classes.map((c) => (
              <li
                key={c.id}
                className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${
                  selected === c.id ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 flex-col items-start text-left"
                  onClick={() => onSelect(selected === c.id ? "" : c.id)}
                >
                  <span className="font-medium text-foreground">{c.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.default_deposit_cents
                      ? `${t("pricing.fields.deposit")} : ${(c.default_deposit_cents / 100).toLocaleString(locale)} DZD`
                      : t("pricing.classes.noDeposit")}
                    {" · "}
                    {t("pricing.classes.manageRates")}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("pricing.actions.delete")}
                  onClick={() => remove.mutate(c.id)}
                >
                  <Trash2 className="size-4" aria-hidden={true} />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t("pricing.fields.className")}</span>
            <input
              className={fieldCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("pricing.classes.namePlaceholder")}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:w-48">
            <span className="text-muted-foreground">{t("pricing.fields.depositDzd")}</span>
            <input
              type="number"
              min="0"
              className={fieldCls}
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              placeholder="0"
            />
          </label>
          <Button onClick={() => create.mutate()} disabled={name.trim() === "" || create.isPending}>
            <Plus className="size-4" aria-hidden={true} />
            {t("pricing.actions.addClass")}
          </Button>
        </div>
        {create.isError && <p className="text-sm text-destructive">{t("pricing.classes.createError")}</p>}
      </CardContent>
    </Card>
  );
}

// ---- Rate plans ----

function RatePlansSection({
  classId,
  className,
  seasons,
}: {
  classId: string;
  className: string;
  seasons: RateSeason[];
}) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const qc = useQueryClient();
  const plansQ = useRatePlansQuery(classId);
  const [seasonId, setSeasonId] = useState("");
  const [daily, setDaily] = useState("");
  const [weekly, setWeekly] = useState("");
  const [monthly, setMonthly] = useState("");

  const key = ["pricing", "ratePlans", classId];
  const create = useMutation({
    mutationFn: () =>
      createRatePlan({
        class_id: classId,
        season_id: seasonId === "" ? null : seasonId,
        daily_cents: toCents(daily),
        weekly_cents: weekly === "" ? null : toCents(weekly),
        monthly_cents: monthly === "" ? null : toCents(monthly),
      }),
    onSuccess: () => {
      setSeasonId("");
      setDaily("");
      setWeekly("");
      setMonthly("");
      void qc.invalidateQueries({ queryKey: key });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteRatePlan(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
  });

  const plans = plansQ.data ?? [];
  const dzd = (cents?: number) => (cents == null ? "—" : `${(cents / 100).toLocaleString(locale)} DZD`);
  const seasonName = (p: RatePlan) =>
    p.season_id ? (seasons.find((s) => s.id === p.season_id)?.name ?? "—") : t("pricing.rates.base");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pricing.rates.title", { class: className })}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("pricing.rates.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {plans.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium text-foreground">{seasonName(p)}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("pricing.fields.daily")} {dzd(p.daily_cents)} · {t("pricing.fields.weekly")} {dzd(p.weekly_cents)} ·{" "}
                    {t("pricing.fields.monthly")} {dzd(p.monthly_cents)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("pricing.actions.delete")}
                  onClick={() => remove.mutate(p.id)}
                >
                  <Trash2 className="size-4" aria-hidden={true} />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-2 border-t border-border pt-4 sm:grid-cols-5 sm:items-end">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t("pricing.fields.season")}</span>
            <select className={fieldCls} value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
              <option value="">{t("pricing.rates.base")}</option>
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <NumField label={t("pricing.fields.dailyDzd")} value={daily} onChange={setDaily} />
          <NumField label={t("pricing.fields.weeklyDzd")} value={weekly} onChange={setWeekly} />
          <NumField label={t("pricing.fields.monthlyDzd")} value={monthly} onChange={setMonthly} />
          <Button onClick={() => create.mutate()} disabled={daily === "" || create.isPending}>
            <Plus className="size-4" aria-hidden={true} />
            {t("pricing.actions.addRate")}
          </Button>
        </div>
        {create.isError && <p className="text-sm text-destructive">{t("pricing.rates.createError")}</p>}
      </CardContent>
    </Card>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="number"
        min="0"
        className={fieldCls}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
      />
    </label>
  );
}

// ---- Extras ----

const EXTRA_CATEGORIES: ExtraCategory[] = ["protection", "equipment", "service", "fee"];
const EXTRA_MODES: ExtraPricingMode[] = ["per_day", "flat", "percent"];

function ExtrasSection({ extras }: { extras: RentalExtra[] }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ExtraCategory>("equipment");
  const [mode, setMode] = useState<ExtraPricingMode>("per_day");
  const [amount, setAmount] = useState("");
  const [percent, setPercent] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createRentalExtra({
        name,
        category,
        pricing_mode: mode,
        amount_cents: mode === "percent" ? null : toCents(amount),
        percent_bp: mode === "percent" ? Math.round(Number(percent) * 100) : null,
      }),
    onSuccess: () => {
      setName("");
      setAmount("");
      setPercent("");
      void qc.invalidateQueries({ queryKey: EXTRAS_KEY });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteRentalExtra(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: EXTRAS_KEY }),
  });

  const priceLabel = (e: RentalExtra) => {
    if (e.pricing_mode === "percent") return `${(e.percent_bp ?? 0) / 100} %`;
    const dzd = `${((e.amount_cents ?? 0) / 100).toLocaleString(locale)} DZD`;
    return e.pricing_mode === "per_day" ? `${dzd}/${t("pricing.extras.perDayShort")}` : dzd;
  };

  const disabled =
    name.trim() === "" ||
    (mode === "percent" ? percent === "" : amount === "") ||
    create.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pricing.extras.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t("pricing.extras.help")}</p>
        {extras.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("pricing.extras.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {extras.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium text-foreground">{e.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {t(`pricing.extras.category.${e.category}`)} · {priceLabel(e)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("pricing.actions.delete")}
                  onClick={() => remove.mutate(e.id)}
                >
                  <Trash2 className="size-4" aria-hidden={true} />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-2 border-t border-border pt-4 sm:grid-cols-5 sm:items-end">
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-muted-foreground">{t("pricing.fields.extraName")}</span>
            <input className={fieldCls} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t("pricing.fields.category")}</span>
            <select className={fieldCls} value={category} onChange={(e) => setCategory(e.target.value as ExtraCategory)}>
              {EXTRA_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`pricing.extras.category.${c}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t("pricing.fields.mode")}</span>
            <select className={fieldCls} value={mode} onChange={(e) => setMode(e.target.value as ExtraPricingMode)}>
              {EXTRA_MODES.map((m) => (
                <option key={m} value={m}>
                  {t(`pricing.extras.mode.${m}`)}
                </option>
              ))}
            </select>
          </label>
          {mode === "percent" ? (
            <NumField label={t("pricing.fields.percent")} value={percent} onChange={setPercent} />
          ) : (
            <NumField label={t("pricing.fields.amountDzd")} value={amount} onChange={setAmount} />
          )}
        </div>
        <div>
          <Button onClick={() => create.mutate()} disabled={disabled}>
            <Plus className="size-4" aria-hidden={true} />
            {t("pricing.actions.addExtra")}
          </Button>
        </div>
        {create.isError && <p className="text-sm text-destructive">{t("pricing.extras.createError")}</p>}
      </CardContent>
    </Card>
  );
}

// ---- Discounts ----

const DISCOUNT_KINDS: DiscountKind[] = ["percent", "fixed"];

function DiscountsSection({
  discounts,
  classes,
}: {
  discounts: RateDiscount[];
  classes: VehicleClass[];
}) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<DiscountKind>("percent");
  const [amount, setAmount] = useState("");
  const [percent, setPercent] = useState("");
  const [code, setCode] = useState("");
  const [classId, setClassId] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [auto, setAuto] = useState(false);

  const create = useMutation({
    mutationFn: () =>
      createRateDiscount({
        name,
        kind,
        amount_cents: kind === "fixed" ? toCents(amount) : null,
        percent_bp: kind === "percent" ? Math.round(Number(percent) * 100) : null,
        code: code.trim() || null,
        class_id: classId || null,
        valid_from: validFrom || null,
        valid_to: validTo || null,
        auto_apply: auto,
      }),
    onSuccess: () => {
      setName("");
      setAmount("");
      setPercent("");
      setCode("");
      setClassId("");
      setValidFrom("");
      setValidTo("");
      setAuto(false);
      void qc.invalidateQueries({ queryKey: DISCOUNTS_KEY });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteRateDiscount(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: DISCOUNTS_KEY }),
  });

  const valueLabel = (d: RateDiscount) =>
    d.kind === "percent"
      ? `${(d.percent_bp ?? 0) / 100} %`
      : `${((d.amount_cents ?? 0) / 100).toLocaleString(locale)} DZD`;
  const scopeLabel = (d: RateDiscount) =>
    d.class_id ? (classes.find((c) => c.id === d.class_id)?.name ?? "—") : t("pricing.discounts.allClasses");
  const codeLabel = (d: RateDiscount) =>
    d.auto_apply ? t("pricing.discounts.auto") : (d.code ?? "—");

  const disabled =
    name.trim() === "" || (kind === "percent" ? percent === "" : amount === "") || create.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pricing.discounts.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t("pricing.discounts.help")}</p>
        {discounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("pricing.discounts.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {discounts.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium text-foreground">
                    {d.name} · {valueLabel(d)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {codeLabel(d)} · {scopeLabel(d)}
                    {(d.valid_from || d.valid_to) && ` · ${d.valid_from ?? "…"} → ${d.valid_to ?? "…"}`}
                    {!d.active && ` · ${t("pricing.discounts.inactive")}`}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("pricing.actions.delete")}
                  onClick={() => remove.mutate(d.id)}
                >
                  <Trash2 className="size-4" aria-hidden={true} />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-2 border-t border-border pt-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t("pricing.fields.discountName")}</span>
            <input className={fieldCls} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t("pricing.fields.kind")}</span>
            <select className={fieldCls} value={kind} onChange={(e) => setKind(e.target.value as DiscountKind)}>
              {DISCOUNT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`pricing.discounts.kind.${k}`)}
                </option>
              ))}
            </select>
          </label>
          {kind === "percent" ? (
            <NumField label={t("pricing.fields.percent")} value={percent} onChange={setPercent} />
          ) : (
            <NumField label={t("pricing.fields.amountDzd")} value={amount} onChange={setAmount} />
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t("pricing.fields.codeOptional")}</span>
            <input className={fieldCls} value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t("pricing.fields.classScope")}</span>
            <select className={fieldCls} value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">{t("pricing.discounts.allClasses")}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">{t("pricing.fields.validFrom")}</span>
              <input type="date" className={fieldCls} value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">{t("pricing.fields.validTo")}</span>
              <input type="date" className={fieldCls} value={validTo} onChange={(e) => setValidTo(e.target.value)} />
            </label>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          {t("pricing.discounts.autoApply")}
        </label>
        <div>
          <Button onClick={() => create.mutate()} disabled={disabled}>
            <Plus className="size-4" aria-hidden={true} />
            {t("pricing.actions.addDiscount")}
          </Button>
        </div>
        {create.isError && <p className="text-sm text-destructive">{t("pricing.discounts.createError")}</p>}
      </CardContent>
    </Card>
  );
}

// ---- Deposit rules ----

function DepositRulesSection({
  rules,
  classes,
  extras,
}: {
  rules: DepositRule[];
  classes: VehicleClass[];
  extras: RentalExtra[];
}) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [classId, setClassId] = useState("");
  const [extraId, setExtraId] = useState("");
  const [deposit, setDeposit] = useState("");
  const [priority, setPriority] = useState("0");

  const create = useMutation({
    mutationFn: () =>
      createDepositRule({
        name,
        class_id: classId || null,
        requires_extra_id: extraId || null,
        deposit_cents: toCents(deposit),
        priority: Number(priority) || 0,
      }),
    onSuccess: () => {
      setName("");
      setClassId("");
      setExtraId("");
      setDeposit("");
      setPriority("0");
      void qc.invalidateQueries({ queryKey: DEPOSIT_RULES_KEY });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteDepositRule(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: DEPOSIT_RULES_KEY }),
  });

  const className = (id?: string) =>
    id ? (classes.find((c) => c.id === id)?.name ?? "—") : t("pricing.depositRules.anyClass");
  const extraName = (id?: string) =>
    id ? (extras.find((e) => e.id === id)?.name ?? "—") : t("pricing.depositRules.noExtra");

  const disabled = name.trim() === "" || deposit === "" || create.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pricing.depositRules.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t("pricing.depositRules.help")}</p>
        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("pricing.depositRules.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rules.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium text-foreground">
                    {r.name} · {(r.deposit_cents / 100).toLocaleString(locale)} DZD
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {className(r.class_id)} · {extraName(r.requires_extra_id)} · {t("pricing.fields.priority")} {r.priority}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("pricing.actions.delete")}
                  onClick={() => remove.mutate(r.id)}
                >
                  <Trash2 className="size-4" aria-hidden={true} />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-2 border-t border-border pt-4 sm:grid-cols-5 sm:items-end">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t("pricing.fields.discountName")}</span>
            <input className={fieldCls} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t("pricing.fields.classScope")}</span>
            <select className={fieldCls} value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">{t("pricing.depositRules.anyClass")}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t("pricing.depositRules.requiresExtra")}</span>
            <select className={fieldCls} value={extraId} onChange={(e) => setExtraId(e.target.value)}>
              <option value="">{t("pricing.depositRules.noExtra")}</option>
              {extras.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <NumField label={t("pricing.fields.depositDzd")} value={deposit} onChange={setDeposit} />
          <NumField label={t("pricing.fields.priority")} value={priority} onChange={setPriority} />
        </div>
        <div>
          <Button onClick={() => create.mutate()} disabled={disabled}>
            <Plus className="size-4" aria-hidden={true} />
            {t("pricing.actions.addDepositRule")}
          </Button>
        </div>
        {create.isError && <p className="text-sm text-destructive">{t("pricing.depositRules.createError")}</p>}
      </CardContent>
    </Card>
  );
}

// ---- Seasons ----

function SeasonsSection({ seasons }: { seasons: RateSeason[] }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [priority, setPriority] = useState("0");

  const create = useMutation({
    mutationFn: () =>
      createRateSeason({
        name,
        start_date: startDate,
        end_date: endDate,
        priority: Number(priority) || 0,
      }),
    onSuccess: () => {
      setName("");
      setStartDate("");
      setEndDate("");
      setPriority("0");
      void qc.invalidateQueries({ queryKey: SEASONS_KEY });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteRateSeason(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: SEASONS_KEY }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pricing.seasons.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t("pricing.seasons.help")}</p>
        {seasons.length > 0 && (
          <ul className="flex flex-col gap-2">
            {seasons.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium text-foreground">{s.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.start_date} → {s.end_date} · {t("pricing.fields.priority")} {s.priority}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("pricing.actions.delete")}
                  onClick={() => remove.mutate(s.id)}
                >
                  <Trash2 className="size-4" aria-hidden={true} />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-2 border-t border-border pt-4 sm:grid-cols-5 sm:items-end">
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-muted-foreground">{t("pricing.fields.seasonName")}</span>
            <input className={fieldCls} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t("pricing.fields.start")}</span>
            <input type="date" className={fieldCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t("pricing.fields.end")}</span>
            <input type="date" className={fieldCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t("pricing.fields.priority")}</span>
            <input type="number" className={fieldCls} value={priority} onChange={(e) => setPriority(e.target.value)} />
          </label>
        </div>
        <div>
          <Button
            onClick={() => create.mutate()}
            disabled={name.trim() === "" || startDate === "" || endDate === "" || create.isPending}
          >
            <Plus className="size-4" aria-hidden={true} />
            {t("pricing.actions.addSeason")}
          </Button>
        </div>
        {create.isError && <p className="text-sm text-destructive">{t("pricing.seasons.createError")}</p>}
      </CardContent>
    </Card>
  );
}
