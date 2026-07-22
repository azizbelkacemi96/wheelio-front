import { http, HttpResponse } from "msw";
import type {
  AgencyResponse,
  AuthResponse,
  MeResponse,
} from "@/types/identity";
import { ownerFixture } from "../fixtures/scope";

/**
 * MSW handlers mirroring wheelio-api's confirmed endpoint shapes (see
 * 01-RESEARCH.md "Phase Requirements" + `dto.go`). Response bodies are typed
 * against src/types/identity.ts so any contract drift fails compilation, not
 * just a runtime assertion.
 *
 * Base URL is read from VITE_API_URL (same env var the real ky client uses),
 * so tests exercise the same request targets the app would hit in dev/prod.
 */

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

function authResponseFor(me: MeResponse): AuthResponse {
  return {
    token_type: "Bearer",
    access_token: "mock-access-token",
    access_token_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    refresh_token: "mock-refresh-token",
    user: me.user,
    organization: me.organization,
  };
}

const defaultAgencies: AgencyResponse[] = ownerFixture.agencies;

export const handlers = [
  http.post(`${API_URL}/auth/login`, () => {
    return HttpResponse.json<AuthResponse>(authResponseFor(ownerFixture.me), {
      status: 200,
    });
  }),

  http.post(`${API_URL}/auth/signup`, () => {
    return HttpResponse.json<AuthResponse>(authResponseFor(ownerFixture.me), {
      status: 201,
    });
  }),

  http.post(`${API_URL}/auth/refresh`, () => {
    // Rotated tokens — same authResponse shape as login/signup per auth_handler.go.
    return HttpResponse.json<AuthResponse>(
      {
        ...authResponseFor(ownerFixture.me),
        access_token: "mock-access-token-rotated",
        refresh_token: "mock-refresh-token-rotated",
      },
      { status: 200 },
    );
  }),

  http.post(`${API_URL}/auth/logout`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API_URL}/me`, () => {
    return HttpResponse.json<MeResponse>(ownerFixture.me, { status: 200 });
  }),

  http.get(`${API_URL}/agencies`, () => {
    return HttpResponse.json<AgencyResponse[]>(defaultAgencies, { status: 200 });
  }),
];
