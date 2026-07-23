/**
 * The `_authenticated` route's component. `beforeLoad` (see
 * `routes/_authenticated.tsx`) has already gated out "no session at all"
 * (redirected to /login); by the time AppShell mounts, `scope` on the auth
 * store is EITHER already resolved (the common case — zero extra network
 * cost here) OR still null because the `/me` call itself failed even though
 * the access token is valid. AppShell owns that second case entirely:
 * it retries `ensureSession()` on mount, renders a skeleton while that is
 * in flight, and — if it fails again — a full-shell error banner with a
 * "Réessayer"/"Retry" action that resets the session memo and tries again.
 * Nothing here ever redirects; only the route guard does that (AUTH-02).
 */
import { useCallback, useEffect, useState } from "react";
import { Outlet } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ensureSession, resetSession } from "@/shared/auth/session";
import { useAuthStore } from "@/shared/auth/store";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { NavRail } from "./NavRail";
import { TopBar } from "./TopBar";

type ShellStatus = "loading" | "ready" | "error";

function ShellSkeleton() {
  return (
    <div className="flex min-h-svh" data-testid="shell-skeleton">
      <aside className="hidden w-56 shrink-0 flex-col gap-2 border-r bg-secondary/40 p-4 md:flex">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </aside>
      <div className="flex flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center border-b px-4">
          <Skeleton className="h-8 w-32" />
        </div>
      </div>
    </div>
  );
}

function ShellErrorBanner({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-svh items-center justify-center p-6" role="alert">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <p className="text-sm text-destructive">{t("shell.meError")}</p>
        <Button onClick={onRetry}>{t("shell.retry")}</Button>
      </div>
    </div>
  );
}

export function AppShell() {
  const scope = useAuthStore((s) => s.scope);
  const [status, setStatus] = useState<ShellStatus>(scope ? "ready" : "loading");

  const load = useCallback(() => {
    setStatus("loading");
    ensureSession()
      .then((result) => setStatus(result ? "ready" : "error"))
      .catch(() => setStatus("error"));
  }, []);

  // Runs once on mount: if beforeLoad already resolved a Scope this is a
  // no-op (scope truthy); if beforeLoad's own `/me` attempt failed, this is
  // the retry-once-automatically attempt before falling back to the banner.
  useEffect(() => {
    if (!scope) load();
    // Intentionally mount-only — retries are triggered explicitly via `load`
    // (mount effect) and `retry` (button), never on every scope reference change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (scope) setStatus("ready");
  }, [scope]);

  const retry = useCallback(() => {
    resetSession();
    load();
  }, [load]);

  if (status === "loading") return <ShellSkeleton />;
  if (status === "error" || !scope) return <ShellErrorBanner onRetry={retry} />;

  return (
    <div className="flex min-h-svh">
      <aside className="hidden w-56 shrink-0 border-r bg-secondary/40 p-4 md:flex md:flex-col">
        <NavRail scope={scope} />
      </aside>
      <div className="flex flex-1 flex-col">
        <TopBar scope={scope} />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
