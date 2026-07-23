import { createFileRoute, isRedirect, redirect } from "@tanstack/react-router";
import { AppShell } from "@/app/shell/AppShell";

/**
 * The one auth guard every feature route mounts under. `beforeLoad` awaits
 * `context.auth.ensureSession()` (memoised bootstrap: refresh-if-needed then
 * `/me` — see `shared/auth/session.ts`) and redirects to `/login` ONLY when
 * it resolves to `null` — a refresh-token failure, the ONE case allowed to
 * bounce an in-progress session (AUTH-02). A successful refresh never
 * redirects, even if the following `/me` call itself then fails: that
 * failure mode REJECTS instead of resolving to `null`, so it is caught here
 * and swallowed (not redirected) — `AppShell` performs its own `/me` retry
 * on mount and renders the full-shell error banner + Retry for that case,
 * per the UI-SPEC's nav error-state contract. This is deliberately NOT the
 * same redirect path as a genuine "no session at all".
 *
 * The "Session expirée" copy is NOT toasted from here: `RouterProvider`
 * does not commit ANY of `__root.tsx`'s tree (including its `<Toaster/>`)
 * until the very first navigation's `beforeLoad` chain settles, so a toast
 * fired from inside this function on a fresh page load would have no
 * subscriber yet and silently vanish. Passing `reason: "session-expired"`
 * as a search param instead lets `/login` (already mounted by the time its
 * own component runs) show the toast reliably on ITS mount.
 */
export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context }) => {
    try {
      const scope = await context.auth.ensureSession();
      if (scope === null) {
        throw redirect({ to: "/login", search: { reason: "session-expired" } });
      }
    } catch (err) {
      if (isRedirect(err)) throw err;
      // /me failed with an otherwise-valid access token — do not redirect;
      // AppShell mounts regardless and handles its own retry + error banner.
    }
  },
  component: AppShell,
});
