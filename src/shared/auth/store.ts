/**
 * Zustand auth store — the single client-side source of truth for the
 * current session's tokens, resolved Scope, and agency selection.
 *
 * Persistence contract (D-11 / 01-RESEARCH.md Pattern 4): ONLY the refresh
 * token is ever written to localStorage. The access token lives in memory
 * for the lifetime of the tab and is re-derived (via refresh or a fresh
 * `/me` bootstrap) on every reload; `scope` is likewise never persisted —
 * it is always re-fetched from `/me`, never trusted from storage.
 *
 * `setCurrentAgency` is a pure client state write (Pattern 3): switching the
 * active agency triggers no `/me` refetch and no `/auth/refresh` call,
 * because `roleInAgency` already resolves org admins to `manager` for any
 * agency without needing a new server round-trip.
 *
 * FLAGGED ASSUMPTION (01-RESEARCH.md Assumptions Log A1 / Open Questions
 * #1): `currentAgencyId` is NOT persisted this phase — it resets to null
 * (callers default to the org's first agency) on a fresh page load. If
 * cross-reload continuity of the selected agency is desired, add
 * `currentAgencyId` to `partialize` in a follow-up plan.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AgencyResponse } from "@/types/identity";
import type { Scope } from "./permissions";

export interface SetTokensInput {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface AuthState {
  /** Memory only — never persisted. */
  accessToken: string | null;
  /** ISO 8601 access token expiry — memory only, re-derived on refresh. */
  accessTokenExpiresAt: string | null;
  /** Persisted via partialize — the only field written to localStorage. */
  refreshToken: string | null;
  /** Refetched via `/me` on boot/refresh; never persisted. */
  scope: Scope | null;
  /** Owner-only, from `GET /agencies`; never persisted. */
  agencies: AgencyResponse[];
  currentAgencyId: string | null;

  setTokens: (tokens: SetTokensInput) => void;
  setScope: (scope: Scope | null) => void;
  setAgencies: (agencies: AgencyResponse[]) => void;
  /** Pure client state change — no network call (D-11 groundwork). */
  setCurrentAgency: (id: string | null) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      accessTokenExpiresAt: null,
      refreshToken: null,
      scope: null,
      agencies: [],
      currentAgencyId: null,

      setTokens: ({ accessToken, refreshToken, expiresAt }) =>
        set({
          accessToken,
          refreshToken,
          accessTokenExpiresAt: expiresAt,
        }),
      setScope: (scope) => set({ scope }),
      setAgencies: (agencies) => set({ agencies }),
      setCurrentAgency: (id) => set({ currentAgencyId: id }),
      clearSession: () =>
        set({
          accessToken: null,
          accessTokenExpiresAt: null,
          refreshToken: null,
          scope: null,
        }),
    }),
    {
      name: "wheelio-auth",
      partialize: (state) => ({ refreshToken: state.refreshToken }),
    },
  ),
);
