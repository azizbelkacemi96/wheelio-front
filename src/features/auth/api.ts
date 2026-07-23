/**
 * Typed calls against wheelio-api's `/auth/*` endpoints for the login and
 * signup screens.
 *
 * `login`/`signup` deliberately use a bare `ky` request (matching the exact
 * same pattern `shared/api/client.ts`'s own `refreshAccessToken` already
 * uses), NOT the shared `api` client with its single-flight-refresh
 * `afterResponse` hook. Both endpoints are unauthenticated and can
 * legitimately return 401 on a genuine login failure (wrong password) or
 * signup validation error — routing them through `api`'s interceptor would
 * misinterpret that 401 as "our own access token expired," attempt an
 * unrelated `/auth/refresh` using whatever refresh token might still be
 * sitting in the store from a previous session, and either (a) throw a
 * confusing "no refresh token" error instead of surfacing the real
 * credentials failure, or (b) silently clear/rotate an unrelated session's
 * tokens as a side effect of a failed *new* login attempt. `logout`, by
 * contrast, IS an authenticated call (needs the Authorization header the
 * shared client injects) and its 401 handling is fine to go through the
 * normal refresh-then-retry path, so it uses `api`.
 */
import ky from "ky";
import { api } from "@/shared/api/client";
import type { AuthResponse } from "@/types/identity";
import type { LoginInput, SignupInput } from "./schemas";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export async function login(input: LoginInput): Promise<AuthResponse> {
  return ky
    .post("auth/login", { json: input, baseUrl: API_URL })
    .json<AuthResponse>();
}

export async function signup(input: SignupInput): Promise<AuthResponse> {
  return ky
    .post("auth/signup", { json: input, baseUrl: API_URL })
    .json<AuthResponse>();
}

export async function logout(): Promise<void> {
  await api.post("auth/logout");
}
