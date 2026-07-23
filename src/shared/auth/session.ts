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
 * The durable success memo is the Scope on the auth store (`setScope`) —
 * checked first on every call, zero network cost once resolved. The
 * module-level promise below ONLY deduplicates the in-flight bootstrap
 * window (concurrent `beforeLoad` + AppShell mount share the SAME promise
 * instead of double-fetching, T-01-refresh) and is cleared as soon as the
 * attempt settles, success or failure. It must NEVER cache an outcome
 * across attempts: a cached resolved-`null` would replay "logged out"
 * forever after a subsequent successful login (login sets tokens but not
 * scope — only bootstrap's `/me` does), and a cached resolved-Scope would
 * let `ensureSession()` resurrect a session after logout cleared the store.
 */
import { api, MissingRefreshTokenError, refreshAccessToken } from "@/shared/api/client";
import { isHTTPError } from "ky";
import type { MeResponse } from "@/types/identity";
import { scopeFromMe, type Scope } from "./permissions";
import { useAuthStore } from "./store";

let sessionPromise: Promise<Scope | null> | null = null;

/**
 * Clears the in-flight bootstrap memo so the NEXT `ensureSession()` call
 * re-attempts the full boot sequence from scratch. The memo already clears
 * itself whenever an attempt settles; this exists for callers that must not
 * race a still-in-flight attempt — logout (so a bootstrap resolving after
 * `clearSession()` isn't awaited by anyone downstream) and AppShell's
 * error-banner "Réessayer"/"Retry".
 */
export function resetSession(): void {
  sessionPromise = null;
}

export async function ensureSession(): Promise<Scope | null> {
  const existingScope = useAuthStore.getState().scope;
  if (existingScope) return existingScope;

  // In-flight dedupe only — `.finally` guarantees the memo never outlives
  // the attempt, so outcomes are always re-derived from live store state.
  sessionPromise ??= bootstrap().finally(() => {
    sessionPromise = null;
  });
  return sessionPromise;
}

async function bootstrap(): Promise<Scope | null> {
  let accessToken = useAuthStore.getState().accessToken;

  if (!accessToken) {
    try {
      accessToken = await refreshAccessToken();
    } catch (err) {
      // "No session can be established" — the ONE redirect case — means the
      // refresh token is absent or the API explicitly rejected it. A network
      // error or 5xx is NOT that: the persisted token may still be valid, so
      // rethrow and let AppShell's retry banner handle it instead of bouncing
      // a recoverable user to /login with a false "Session expirée".
      if (
        err instanceof MissingRefreshTokenError ||
        (isHTTPError(err) && (err.response.status === 401 || err.response.status === 403))
      ) {
        return null;
      }
      throw err;
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
