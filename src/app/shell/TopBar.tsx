/**
 * Persistent top bar: mobile nav trigger (Sheet drawer, <md) + the
 * owner-only agency switcher (D-10/D-11) + language switcher + user menu.
 */
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Building2, Check, Globe, LogOut, Menu } from "lucide-react";
import { api } from "@/shared/api/client";
import { logout } from "@/features/auth/api";
import { isOrgAdmin, type Scope } from "@/shared/auth/permissions";
import { resetSession } from "@/shared/auth/session";
import { useAuthStore } from "@/shared/auth/store";
import { useLocale } from "@/shared/i18n/useLocale";
import type { AgencyResponse } from "@/types/identity";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/shared/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { NavRail } from "./NavRail";

export interface TopBarProps {
  scope: Scope;
}

function AgencySwitcher({ scope }: { scope: Scope }) {
  const { t } = useTranslation();
  const agencies = useAuthStore((s) => s.agencies);
  const currentAgencyId = useAuthStore((s) => s.currentAgencyId);
  const setAgencies = useAuthStore((s) => s.setAgencies);
  const setCurrentAgency = useAuthStore((s) => s.setCurrentAgency);

  const { data } = useQuery({
    queryKey: ["agencies"],
    queryFn: () => api.get("agencies").json<AgencyResponse[]>(),
    enabled: isOrgAdmin(scope),
  });

  useEffect(() => {
    if (data) setAgencies(data);
  }, [data, setAgencies]);

  useEffect(() => {
    if (!currentAgencyId && agencies.length > 0) {
      setCurrentAgency(agencies[0]!.id);
    }
  }, [agencies, currentAgencyId, setCurrentAgency]);

  if (!isOrgAdmin(scope)) return null;

  const current = agencies.find((a) => a.id === currentAgencyId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={t("shell.agencySwitcher")}
          className="max-w-48 justify-start gap-1.5"
        >
          <Building2 className="size-3.5 shrink-0" aria-hidden={true} />
          <span className="truncate" title={current?.name}>
            {current?.name ?? t("shell.agencySwitcher")}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 min-w-56 overflow-y-auto">
        <DropdownMenuLabel>{t("shell.agencySwitcher")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {agencies.map((agency) => (
          <DropdownMenuItem
            key={agency.id}
            onSelect={() => setCurrentAgency(agency.id)}
            className="justify-between gap-2"
          >
            <span className="truncate" title={agency.name}>
              {agency.name}
            </span>
            {agency.id === currentAgencyId && (
              <Check className="size-3.5 shrink-0 text-primary" aria-hidden={true} />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LanguageSwitcher() {
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();
  const next = locale === "fr" ? "en" : "fr";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("shell.languageSwitcher")}
          className="min-h-11 min-w-11 gap-1 md:min-h-0 md:min-w-0"
          onClick={() => void setLocale(next)}
        >
          <Globe className="size-4" aria-hidden={true} />
          <span className="text-xs font-medium uppercase">{locale}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t("shell.languageSwitcher")}</TooltipContent>
    </Tooltip>
  );
}

function UserMenu({ scope }: { scope: Scope }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);

  const displayName = user ? `${user.first_name} ${user.last_name}` : "";
  const initials = user ? `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}` : "?";
  const roleLabel = isOrgAdmin(scope)
    ? t(`roles.${scope.orgRole}`)
    : t(`roles.${Object.values(scope.agencyRoles)[0] ?? "viewer"}`);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      clearSession();
      // Drop the bootstrap memo so an in-flight ensureSession() can't
      // resurrect the pre-logout Scope, and purge the react-query cache so
      // no cross-org data (agency list, later feature data) survives into
      // the next login on this tab.
      resetSession();
      queryClient.clear();
      await navigate({ to: "/login" });
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("shell.userMenu")}
          className="rounded-full"
        >
          <Avatar>
            <AvatarFallback>{initials.toUpperCase()}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate font-medium text-foreground" title={displayName}>
            {displayName}
          </span>
          <span className="text-xs font-normal text-muted-foreground">{roleLabel}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void handleLogout()}>
          <LogOut className="size-4" aria-hidden={true} />
          {t("shell.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TopBar({ scope }: TopBarProps) {
  const { t } = useTranslation();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-background px-4">
      <Sheet>
        <Tooltip>
          <TooltipTrigger asChild>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("shell.openNav")}
                className="min-h-11 min-w-11 md:hidden"
              >
                <Menu className="size-5" aria-hidden={true} />
              </Button>
            </SheetTrigger>
          </TooltipTrigger>
          <TooltipContent>{t("shell.openNav")}</TooltipContent>
        </Tooltip>
        <SheetContent side="left" className="w-64">
          <SheetHeader>
            <SheetTitle>Wheelio</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            <NavRail scope={scope} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="hidden md:block" />

      <div className="flex items-center gap-2">
        <AgencySwitcher scope={scope} />
        <LanguageSwitcher />
        <UserMenu scope={scope} />
      </div>
    </header>
  );
}
