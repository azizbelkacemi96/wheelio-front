/**
 * The primary navigation list — rendered both inside the persistent desktop
 * rail and inside the mobile Sheet drawer (TopBar wires the latter).
 *
 * D-08: the base nav (Aujourd'hui/Véhicules/Clients/Contrats/États des
 * lieux) is IDENTICAL for every role — nothing here is hidden by role.
 * D-09: the 3 admin sections are rendered ONLY when `isOrgAdmin(scope)` is
 * true, and are fully absent (not disabled/greyed) otherwise.
 *
 * Only "Aujourd'hui" has a real route this phase (mapped to "/") — the rest
 * are 01-07's placeholder-route scope; clicking them surfaces the
 * "Bientôt disponible" empty-state copy via a toast rather than navigating
 * to a route that doesn't exist yet (see 01-06-SUMMARY.md Deviations).
 */
import type { ComponentType } from "react";
import { Link, useMatchRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Building2,
  Car,
  ClipboardCheck,
  FileText,
  Home,
  Landmark,
  Receipt,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isOrgAdmin, type Scope } from "@/shared/auth/permissions";

interface NavItemDef {
  key: string;
  labelKey: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  /** Only set for routes that exist this phase. */
  to?: "/";
}

const BASE_NAV_ITEMS: NavItemDef[] = [
  { key: "today", labelKey: "nav.today", icon: Home, to: "/" },
  { key: "vehicles", labelKey: "nav.vehicles", icon: Car },
  { key: "customers", labelKey: "nav.customers", icon: Users },
  { key: "contracts", labelKey: "nav.contracts", icon: FileText },
  { key: "inspections", labelKey: "nav.inspections", icon: ClipboardCheck },
];

const ADMIN_NAV_ITEMS: NavItemDef[] = [
  { key: "fiscalIdentity", labelKey: "nav.admin.fiscalIdentity", icon: Landmark },
  { key: "agencies", labelKey: "nav.admin.agencies", icon: Building2 },
  { key: "billing", labelKey: "nav.admin.billing", icon: Receipt },
];

const itemClassName = (isActive: boolean) =>
  cn(
    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
    isActive && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
  );

function NavLinkItem({ item, onNavigate }: { item: NavItemDef; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();
  const Icon = item.icon;

  if (item.to) {
    const isActive = !!matchRoute({ to: item.to });
    return (
      <Link to={item.to} className={itemClassName(isActive)} onClick={onNavigate}>
        <Icon className="size-4 shrink-0" aria-hidden={true} />
        <span className="truncate">{t(item.labelKey)}</span>
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={itemClassName(false)}
      onClick={() => {
        toast(t("emptyState.heading"), { description: t("emptyState.body") });
        onNavigate?.();
      }}
    >
      <Icon className="size-4 shrink-0" aria-hidden={true} />
      <span className="truncate">{t(item.labelKey)}</span>
    </button>
  );
}

export interface NavRailProps {
  scope: Scope;
  /** Called after selecting an item — the mobile Sheet drawer uses this to
   * close itself; the persistent desktop rail leaves it undefined. */
  onNavigate?: () => void;
}

export function NavRail({ scope, onNavigate }: NavRailProps) {
  const { t } = useTranslation();
  const showAdmin = isOrgAdmin(scope);

  return (
    <nav aria-label={t("nav.mainLabel")} className="flex flex-col gap-1">
      {BASE_NAV_ITEMS.map((item) => (
        <NavLinkItem key={item.key} item={item} onNavigate={onNavigate} />
      ))}
      {showAdmin && (
        <>
          <div role="separator" aria-orientation="horizontal" className="my-2 h-px bg-border" />
          {ADMIN_NAV_ITEMS.map((item) => (
            <NavLinkItem key={item.key} item={item} onNavigate={onNavigate} />
          ))}
        </>
      )}
    </nav>
  );
}
