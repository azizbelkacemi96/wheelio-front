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
 * `prefixUrl` -> `baseUrl`, hooks now receive a single destructured state
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

import ky from "ky";
import { useAuthStore } from "@/shared/auth/store";
import type { AuthResponse } from "@/types/identity";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

// Module-level, outside React/Zustand state on purpose: a race-free
// single-flight guard needs a plain synchronous check-and-set, and
// Zustand/React state updates are not synchronous enough for that.
let refreshPromise: Promise<string> | null = null;

/**
 * Exchanges the stored refresh token for a fresh access/refresh pair via
 * `POST /auth/refresh`, updates the store, and returns the new access
 * token. On any failure (no refresh token, or the API rejects it) the
 * session is cleared and the error is rethrown — the only path in this
 * module that ends in a login redirect (handled by the caller/route guard).
 */
export async function refreshAccessToken(): Promise<string> {
  const { refreshToken, setTokens, clearSession } = useAuthStore.getState();

  if (!refreshToken) {
    clearSession();
    throw new Error("no refresh token");
  }

  try {
    const res = await ky
      .post("auth/refresh", {
        json: { refresh_token: refreshToken },
        baseUrl: API_URL,
      })
      .json<AuthResponse>();

    setTokens({
      accessToken: res.access_token,
      refreshToken: res.refresh_token,
      expiresAt: res.access_token_expires_at,
    });

    return res.access_token;
  } catch (err) {
    clearSession();
    throw err;
  }
}

export const api = ky.create({
  baseUrl: API_URL,
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

        // ??= assigns only if refreshPromise is still null — the first
        // afterResponse invocation to reach this line synchronously claims
        // the shared promise before yielding; every other concurrent 401
        // sees the already-assigned promise and awaits the SAME refresh.
        refreshPromise ??= refreshAccessToken().finally(() => {
          refreshPromise = null;
        });

        const newAccessToken = await refreshPromise;

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
