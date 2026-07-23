/**
 * Session bootstrap — the single place the `_authenticated` route guard's
 * `beforeLoad` (and AppShell's own mount-time load / error-banner Retry)
 * go through to resolve a Scope.
 *
 * Boot sequence (01-RESEARCH.md System Architecture Diagram): read the
 * persisted refresh token -> refresh (ONLY if no access token is already in
 * memory — a fresh login already has one, see 01-05) -> GET /me -> map
 * through scopeFromMe.
 *
 * The two failure modes are deliberately NOT collapsed into the same
 * outcome (AUTH-02):
 *  - Refresh itself fails (no refresh token, or the API rejects it) -> this
 *    function resolves to `null`. This is the ONE condition the
 *    `_authenticated` guard treats as "no session can be established" and
 *    redirects to /login with the "Session expirée" copy.
 *  - Refresh succeeds (or wasn't needed) but the subsequent `/me` call fails
 *    -> this function REJECTS instead of resolving to `null`, so a caller
 *    can tell "not logged in" apart from "logged in, profile temporarily
 *    unavailable" and render a retry affordance instead of bouncing an
 *    authenticated user back out to the login screen.
 *
 * Memoised for the session: once a Scope is resolved it lives on the auth
 * store (`setScope`) and every subsequent call returns it with zero network
 * cost; concurrent callers during the bootstrap window share the SAME
 * in-flight promise instead of firing duplicate `/me` requests (T-01-refresh
 * — this is what lets `_authenticated`'s beforeLoad and AppShell's own
 * mount-time check both call `ensureSession()` without ever double-fetching
 * on the happy path).
 */
import { api, refreshAccessToken } from "@/shared/api/client";
import type { MeResponse } from "@/types/identity";
import { scopeFromMe, type Scope } from "./permissions";
import { useAuthStore } from "./store";

let sessionPromise: Promise<Scope | null> | null = null;

/**
 * Clears the in-flight/failed bootstrap memo so the NEXT `ensureSession()`
 * call re-attempts the full boot sequence from scratch. Used by AppShell's
 * error-banner "Réessayer"/"Retry" action after a `/me` failure — never
 * called after a successful bootstrap (the resolved Scope on the store is
 * itself the fast-path memo at that point).
 */
export function resetSession(): void {
  sessionPromise = null;
}

export async function ensureSession(): Promise<Scope | null> {
  const existingScope = useAuthStore.getState().scope;
  if (existingScope) return existingScope;

  if (!sessionPromise) {
    sessionPromise = bootstrap().catch((err: unknown) => {
      // Allow a future call (e.g. Retry, or a fresh beforeLoad on the next
      // navigation) to re-attempt instead of replaying this same rejection
      // forever.
      sessionPromise = null;
      throw err;
    });
  }
  return sessionPromise;
}

async function bootstrap(): Promise<Scope | null> {
  let accessToken = useAuthStore.getState().accessToken;

  if (!accessToken) {
    try {
      accessToken = await refreshAccessToken();
    } catch {
      return null; // no session can be established — the ONE redirect case
    }
  }

  const me = await api.get("me").json<MeResponse>();
  const scope = scopeFromMe(me);
  const { setScope, setUser } = useAuthStore.getState();
  setScope(scope);
  setUser({
    first_name: me.user.first_name,
    last_name: me.user.last_name,
    email: me.user.email,
  });
  return scope;
}
