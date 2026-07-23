import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { Toaster } from "@/shared/ui/sonner";
import type { Scope } from "@/shared/auth/permissions";

/**
 * Router context shape, provided once by `src/app/router.tsx`'s `context`
 * option and consumed by `_authenticated.tsx`'s `beforeLoad`. `ensureSession`
 * is the memoised session bootstrap from `shared/auth/session.ts` — kept as
 * a context function (rather than importing session.ts directly inside the
 * route file) so route files stay swappable/testable against a fake auth
 * context (see router.test.tsx).
 */
export interface RouterContext {
  auth: {
    ensureSession: () => Promise<Scope | null>;
  };
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  // <Toaster/> is deliberately rendered BEFORE <Outlet/>: React fires effects
  // depth-first in JSX declaration order, so a route deep inside <Outlet/>
  // that toasts on mount (e.g. login.tsx's session-expired banner) would
  // otherwise run its effect before Toaster's own subscribing effect,
  // silently dropping the toast into an unsubscribed store.
  return (
    <>
      <Toaster />
      <Outlet />
    </>
  );
}
