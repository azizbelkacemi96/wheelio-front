/**
 * The primary navigation list — rendered both inside the persistent desktop
 * rail and inside the mobile Sheet drawer (TopBar wires the latter).
 *
 * D-08: the base nav (Aujourd'hui/Véhicules/Clients/Contrats/États des
 * lieux) is IDENTICAL for every role — nothing here is hidden by role.
 * D-09: the 3 admin sections are rendered ONLY when `isOrgAdmin(scope)` is
 * true, and are fully absent (not disabled/greyed) otherwise.
 *
 * Every item links to a real route since 01-07's placeholder routes exist —
 * the 01-06 era "toast instead of navigating" fallback for route-less items
 * is gone (no dead links, per 01-07's must-have truths).
 */
import type { ComponentType } from "react";
import { Link, useMatchRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Building2,
  CalendarDays,
  Car,
  ClipboardCheck,
  FileText,
  Home,
  Landmark,
  Tags,
  UserCog,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isOrgAdmin, type Scope } from "@/shared/auth/permissions";

type NavPath =
  | "/"
  | "/planning"
  | "/vehicules"
  | "/clients"
  | "/contrats"
  | "/etats-des-lieux"
  | "/admin/identite-fiscale"
  | "/admin/tarification"
  | "/admin/agences"
  | "/admin/utilisateurs";

interface NavItemDef {
  key: string;
  labelKey: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  to: NavPath;
}

const BASE_NAV_ITEMS: NavItemDef[] = [
  { key: "today", labelKey: "nav.today", icon: Home, to: "/" },
  { key: "planning", labelKey: "nav.planning", icon: CalendarDays, to: "/planning" },
  { key: "vehicles", labelKey: "nav.vehicles", icon: Car, to: "/vehicules" },
  { key: "customers", labelKey: "nav.customers", icon: Users, to: "/clients" },
  { key: "contracts", labelKey: "nav.contracts", icon: FileText, to: "/contrats" },
  {
    key: "inspections",
    labelKey: "nav.inspections",
    icon: ClipboardCheck,
    to: "/etats-des-lieux",
  },
];

const ADMIN_NAV_ITEMS: NavItemDef[] = [
  {
    key: "fiscalIdentity",
    labelKey: "nav.admin.fiscalIdentity",
    icon: Landmark,
    to: "/admin/identite-fiscale",
  },
  { key: "pricing", labelKey: "nav.admin.pricing", icon: Tags, to: "/admin/tarification" },
  { key: "agencies", labelKey: "nav.admin.agencies", icon: Building2, to: "/admin/agences" },
  { key: "users", labelKey: "nav.admin.users", icon: UserCog, to: "/admin/utilisateurs" },
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
  const isActive = !!matchRoute({ to: item.to });

  return (
    <Link to={item.to} className={itemClassName(isActive)} onClick={onNavigate}>
      <Icon className="size-4 shrink-0" aria-hidden={true} />
      <span className="truncate">{t(item.labelKey)}</span>
    </Link>
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
