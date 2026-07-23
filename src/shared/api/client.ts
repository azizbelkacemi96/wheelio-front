/**
 * The ky API client every authenticated request in this app uses.
 *
 * Implements the single-flight refresh interceptor (01-RESEARCH.md Pattern
 * 1, adapted for ky v2's hook API — see the deviation note below): a
 * module-level shared `refreshPromise` guards concurrent 401s so that only
 * ONE `POST /auth/refresh` is ever in flight at a time. wheelio-api rotates
 * refresh tokens and revokes the whole session on stale-refresh reuse
 * (theft detection) — a naive per-request independent 401->refresh->retry
 * would race that detection and silently log the user out (Pitfall 1).
 *
 * Refresh success never redirects (AUTH-02): the original request retries
 * once with the rotated token and resolves normally. Refresh FAILURE is the
 * one case allowed to end in a login redirect — `refreshAccessToken` clears
 * the session and rethrows; the caller/route guard is responsible for
 * acting on that rejection (this module never navigates itself).
 *
 * ky v2 API note: the installed `ky` (2.0.2) is a major version ahead of
 * 01-RESEARCH.md's Pattern 1 code sample (written against ky v1's
 * positional-argument hooks and `prefixUrl` option). ky v2 renamed
 * `prefixUrl` -> `prefix` (concatenation with slash normalization at the
 * join boundary). We use `prefix`, NOT ky v2's `baseUrl`: `baseUrl` does
 * standard `new URL(input, base)` resolution, which silently DROPS the
 * `/v1` path segment of `http://localhost:8080/v1` when joining a relative
 * input like `"vehicles"` (a base without a trailing slash resolves
 * relative inputs against its parent). `prefix` always yields
 * `{API_URL}/{input}`. Hooks receive a single destructured state
 * object (`{request, response, retryCount}`), and forcing a single retry
 * from `afterResponse` is done via the built-in `ky.retry({request, code})`
 * — which explicitly bypasses ky's default retry `methods` allow-list for
 * forced retries (confirmed in ky's own source), so this works for POST/PUT
 * requests too, not just GET. The `retryCount === 0` guard replaces the
 * research doc's implicit "retry once" behavior: ky.retry's own retried
 * invocation of afterResponse arrives with `retryCount === 1`, so a second
 * 401 on the retried request falls through to a normal thrown HTTPError
 * instead of looping.
 */

import ky, { isHTTPError } from "ky";
import { useAuthStore } from "@/shared/auth/store";
import type { AuthResponse } from "@/types/identity";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080/v1";

/** Thrown by `refreshAccessToken` when there is no persisted refresh token
 * at all — callers (session bootstrap) treat it as "genuinely logged out",
 * distinct from a transient network/5xx failure of the refresh call. */
export class MissingRefreshTokenError extends Error {
  constructor() {
    super("no refresh token");
    this.name = "MissingRefreshTokenError";
  }
}

// Module-level, outside React/Zustand state on purpose: a race-free
// single-flight guard needs a plain synchronous check-and-set, and
// Zustand/React state updates are not synchronous enough for that.
let refreshPromise: Promise<string> | null = null;

/**
 * Exchanges the stored refresh token for a fresh access/refresh pair via
 * `POST /auth/refresh`, updates the store, and returns the new access token.
 *
 * Single-flight lives HERE, not only in the interceptor: wheelio-api
 * rotates refresh tokens and revokes the whole session when a stale one is
 * reused (theft detection), so EVERY caller — the 401 interceptor below AND
 * the session bootstrap's direct call — must share one in-flight refresh.
 *
 * The session is cleared only when the API explicitly rejects the token
 * (401/403) or none is stored; a network error or 5xx rethrows WITHOUT
 * clearing, so a connectivity blip never force-logs the user out.
 */
export function refreshAccessToken(): Promise<string> {
  refreshPromise ??= doRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function doRefresh(): Promise<string> {
  const { refreshToken, setTokens, clearSession } = useAuthStore.getState();

  if (!refreshToken) {
    clearSession();
    throw new MissingRefreshTokenError();
  }

  try {
    const res = await ky
      .post("auth/refresh", {
        json: { refresh_token: refreshToken },
        prefix: API_URL,
      })
      .json<AuthResponse>();

    setTokens({
      accessToken: res.access_token,
      refreshToken: res.refresh_token,
      expiresAt: res.access_token_expires_at,
    });

    return res.access_token;
  } catch (err) {
    if (isHTTPError(err) && (err.response.status === 401 || err.response.status === 403)) {
      clearSession();
    }
    throw err;
  }
}

export const api = ky.create({
  prefix: API_URL,
  hooks: {
    beforeRequest: [
      ({ request }) => {
        const { accessToken } = useAuthStore.getState();
        if (accessToken) {
          request.headers.set("Authorization", `Bearer ${accessToken}`);
        }
      },
    ],
    afterResponse: [
      async ({ request, response, retryCount }) => {
        // Only trigger a refresh on the ORIGINAL request's 401, never on the
        // retried request's own response — that is what bounds this to
        // exactly one retry per request instead of looping forever.
        if (response.status !== 401 || retryCount > 0) return;

        // refreshAccessToken is itself single-flight: every concurrent 401
        // (and any parallel session-bootstrap refresh) awaits the SAME
        // in-flight POST /auth/refresh.
        const newAccessToken = await refreshAccessToken();

        const headers = new Headers(request.headers);
        headers.set("Authorization", `Bearer ${newAccessToken}`);

        return ky.retry({
          request: new Request(request, { headers }),
          code: "TOKEN_REFRESHED",
        });
      },
    ],
  },
});
