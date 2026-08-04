/**
 * Public booking storefront (BOOK-01) — an UNAUTHENTICATED multi-step widget:
 * search availability for a date range → pick a vehicle class (with live price
 * from the pricing engine) → enter customer details → reservation created (a
 * 'reserved' contract, no payment). The org is identified by its public `slug`.
 * Standalone page (no app shell); theme-aware via the shared tokens.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarCheck, CircleCheckBig, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/useLocale";
import { Button } from "@/shared/ui/button";
import { WheelioMark } from "@/shared/ui/brand";
import {
  createBooking,
  getAvailability,
  getPublicOrg,
  type BookingResult,
  type ClassAvailability,
  type PublicOrg,
} from "./publicApi";

const field =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function PublicBooking({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const [org, setOrg] = useState<PublicOrg | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let live = true;
    getPublicOrg(slug)
      .then((o) => live && setOrg(o))
      .catch(() => live && setNotFound(true));
    return () => {
      live = false;
    };
  }, [slug]);

  const dzd = (cents: number) => `${(cents / 100).toLocaleString(locale)} DZD`;

  // search state
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [avail, setAvail] = useState<ClassAvailability[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // booking state
  const [chosen, setChosen] = useState<ClassAvailability | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [cin, setCin] = useState("");
  const [license, setLicense] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [result, setResult] = useState<BookingResult | null>(null);

  if (notFound) {
    return (
      <Shell>
        <p className="text-center text-sm text-muted-foreground">{t("booking.public.notFound")}</p>
      </Shell>
    );
  }
  if (!org) {
    return (
      <Shell>
        <div className="flex justify-center py-10">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden={true} />
        </div>
      </Shell>
    );
  }

  const toggleExtra = (id: string) =>
    setSelectedExtras((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  async function search() {
    setSearching(true);
    setSearchError(null);
    setAvail(null);
    setChosen(null);
    try {
      const items = await getAvailability(slug, from, to, selectedExtras, code);
      setAvail(items);
    } catch {
      setSearchError(t("booking.public.searchError"));
    } finally {
      setSearching(false);
    }
  }

  async function book() {
    if (!chosen) return;
    setSubmitting(true);
    setSubmitError(false);
    try {
      const res = await createBooking(slug, {
        class_id: chosen.class_id,
        start_date: from,
        end_date: to,
        extra_ids: selectedExtras,
        discount_code: code.trim() || undefined,
        customer: {
          full_name: fullName,
          phone,
          identity_doc_number: cin || undefined,
          license_number: license || undefined,
        },
      });
      setResult(res);
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  }

  // ---- Confirmation ----
  if (result) {
    return (
      <Shell orgName={org.name}>
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <CircleCheckBig className="size-12 text-emerald-500" aria-hidden={true} />
          <h2 className="font-heading text-xl font-semibold text-foreground">
            {t("booking.public.confirmedTitle")}
          </h2>
          <p className="max-w-sm text-sm text-muted-foreground">{t("booking.public.confirmedBody")}</p>
          <div className="mt-2 w-full max-w-sm rounded-lg border border-border bg-muted/40 p-4 text-sm">
            <Row label={t("booking.public.ref")} value={result.booking_ref.slice(0, 8).toUpperCase()} />
            <Row label={t("booking.public.period")} value={`${from} → ${to}`} />
            <Row label={t("booking.public.total")} value={dzd(result.quote.total_cents)} strong />
            <Row label={t("booking.public.deposit")} value={dzd(result.quote.deposit_cents)} />
          </div>
          <p className="text-xs text-muted-foreground">{t("booking.public.payAtCounter")}</p>
          <Button variant="outline" onClick={() => window.location.reload()} className="mt-2">
            {t("booking.public.newBooking")}
          </Button>
        </div>
      </Shell>
    );
  }

  // ---- Customer step ----
  if (chosen) {
    return (
      <Shell orgName={org.name}>
        <button
          type="button"
          className="mb-3 text-sm text-primary hover:underline"
          onClick={() => setChosen(null)}
        >
          ← {t("booking.public.back")}
        </button>
        <h2 className="mb-1 font-heading text-lg font-semibold text-foreground">
          {t("booking.public.yourDetails")}
        </h2>
        <div className="mb-4 rounded-lg border border-primary/25 bg-primary/5 p-3 text-sm">
          <Row label={chosen.class_name} value={`${from} → ${to}`} />
          <Row label={t("booking.public.total")} value={dzd(chosen.quote.total_cents)} strong />
          <Row label={t("booking.public.deposit")} value={dzd(chosen.quote.deposit_cents)} />
        </div>
        <div className="flex flex-col gap-3">
          <Labeled label={t("booking.public.fullName")}>
            <input className={field} value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Labeled>
          <Labeled label={t("booking.public.phone")}>
            <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Labeled>
          <div className="grid gap-3 sm:grid-cols-2">
            <Labeled label={t("booking.public.cin")}>
              <input className={field} value={cin} onChange={(e) => setCin(e.target.value)} />
            </Labeled>
            <Labeled label={t("booking.public.license")}>
              <input className={field} value={license} onChange={(e) => setLicense(e.target.value)} />
            </Labeled>
          </div>
          {submitError && <p className="text-sm text-destructive">{t("booking.public.bookError")}</p>}
          <Button
            onClick={book}
            disabled={fullName.trim() === "" || phone.trim() === "" || submitting}
            className="mt-1"
          >
            {submitting && <Loader2 className="size-4 animate-spin" aria-hidden={true} />}
            {t("booking.public.confirm")}
          </Button>
        </div>
      </Shell>
    );
  }

  // ---- Search step ----
  return (
    <Shell orgName={org.name}>
      <h2 className="mb-3 font-heading text-lg font-semibold text-foreground">
        {t("booking.public.searchTitle")}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Labeled label={t("booking.public.pickup")}>
          <input type="date" className={field} value={from} onChange={(e) => setFrom(e.target.value)} />
        </Labeled>
        <Labeled label={t("booking.public.return")}>
          <input type="date" className={field} value={to} onChange={(e) => setTo(e.target.value)} />
        </Labeled>
      </div>

      {org.extras.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          <span className="text-sm text-muted-foreground">{t("booking.public.options")}</span>
          <div className="flex flex-wrap gap-2">
            {org.extras.map((e) => {
              const on = selectedExtras.includes(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => toggleExtra(e.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm",
                    on
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {e.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Labeled label={t("booking.public.code")} className="sm:max-w-[12rem]">
          <input className={field} value={code} onChange={(e) => setCode(e.target.value)} />
        </Labeled>
        <Button onClick={search} disabled={from === "" || to === "" || searching}>
          {searching ? (
            <Loader2 className="size-4 animate-spin" aria-hidden={true} />
          ) : (
            <CalendarCheck className="size-4" aria-hidden={true} />
          )}
          {t("booking.public.search")}
        </Button>
      </div>

      {searchError && <p className="mt-3 text-sm text-destructive">{searchError}</p>}

      {avail && (
        <div className="mt-5 flex flex-col gap-2">
          {avail.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("booking.public.noAvailability")}</p>
          ) : (
            avail.map((a) => (
              <div
                key={a.class_id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-4"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">{a.class_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("booking.public.availableCount", { count: a.available_count })}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-semibold text-foreground">{dzd(a.quote.total_cents)}</div>
                    <div className="text-xs text-muted-foreground">
                      {t("booking.public.durationDays", { count: a.quote.duration_days })}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => setChosen(a)}>
                    {t("booking.public.choose")}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children, orgName }: { children: React.ReactNode; orgName?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-svh flex-col items-center bg-muted/30 px-4 py-8">
      <div className="mb-6 flex flex-col items-center gap-2">
        <WheelioMark className="size-14 rounded-2xl shadow-sm" />
        <span className="font-heading text-lg font-semibold text-foreground">
          {orgName ?? t("booking.public.brand")}
        </span>
        <span className="text-xs text-muted-foreground">{t("booking.public.tagline")}</span>
      </div>
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-background p-5 shadow-sm md:p-6">
        {children}
      </div>
    </div>
  );
}

function Labeled({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("flex flex-1 flex-col gap-1 text-sm", className)}>
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "text-base font-semibold text-foreground" : "text-foreground"}>
        {value}
      </span>
    </div>
  );
}
