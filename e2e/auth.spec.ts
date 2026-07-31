/**
 * Phase 01 top-level E2E proof (01-07): login -> authenticated shell ->
 * role-gated nav -> placeholder routes, driven headless against the built
 * app served by playwright.config.ts's webServer (vite preview :4173).
 *
 * API mode: MOCKED. wheelio-api was not reachable at execution time, and the
 * role-aware assertions below need BOTH an owner and an agent account —
 * something a live DB can't guarantee deterministically. Every request to
 * VITE_API_URL is intercepted via page.route() and fulfilled with fixtures
 * imported from src/test/fixtures/scope.ts (the same confirmed dto.go shapes
 * MSW uses in vitest), so the happy path runs deterministically.
 *
 * Credentials are dummy fixture values (the mock accepts anything) — never
 * real secrets, and no token is ever logged (T-01-e2e-secret).
 */
import { test, expect, type Page } from "@playwright/test";
import {
  agentFixture,
  ownerFixture,
  type RoleFixture,
} from "../src/test/fixtures/scope";

// Must match the app's own fallback in src/shared/api/client.ts — the build
// under test was produced without VITE_API_URL set.
const API_URL = process.env.VITE_API_URL ?? "http://localhost:8080/v1";

// Dummy fixture credentials — the mocked API accepts anything (T-01-e2e-secret).
const E2E_EMAIL = process.env.E2E_EMAIL ?? "owner@wheelio.dz";
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "e2e-password-not-a-secret";

// Fulfilled cross-origin responses still go through the browser's CORS
// checks (page origin :4173 -> API origin :8080), so every mock response
// needs these headers and OPTIONS preflights must be answered.
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers": "authorization,content-type",
};

interface ApiCallCounts {
  me: number;
  refresh: number;
}

/** Intercepts every API request and serves role-fixture responses matching
 * wheelio-api's confirmed shapes. Returns live call counters so tests can
 * assert "zero extra /me / /auth/refresh" invariants (D-10/D-11). */
async function mockApi(page: Page, fixture: RoleFixture): Promise<ApiCallCounts> {
  const counts: ApiCallCounts = { me: 0, refresh: 0 };

  const authResponse = {
    token_type: "Bearer",
    access_token: "e2e-mock-access-token",
    access_token_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    refresh_token: "e2e-mock-refresh-token",
    user: fixture.me.user,
    organization: fixture.me.organization,
  };

  // Backend routes live under the /v1 prefix (see the 02-01 base-URL fix).
  // Strip that prefix so the path comparisons below stay backend-relative.
  const apiBasePath = new URL(API_URL).pathname.replace(/\/$/, "");

  await page.route(`${API_URL}/**`, async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const path = pathname.startsWith(apiBasePath)
      ? pathname.slice(apiBasePath.length)
      : pathname;
    const method = request.method();

    if (method === "OPTIONS") {
      return route.fulfill({ status: 204, headers: CORS_HEADERS });
    }
    if (method === "POST" && path === "/auth/login") {
      return route.fulfill({ status: 200, headers: CORS_HEADERS, json: authResponse });
    }
    if (method === "POST" && path === "/auth/refresh") {
      counts.refresh += 1;
      return route.fulfill({ status: 200, headers: CORS_HEADERS, json: authResponse });
    }
    if (method === "POST" && path === "/auth/logout") {
      return route.fulfill({ status: 204, headers: CORS_HEADERS });
    }
    if (method === "GET" && path === "/me") {
      counts.me += 1;
      return route.fulfill({ status: 200, headers: CORS_HEADERS, json: fixture.me });
    }
    if (method === "GET" && path === "/agencies") {
      return route.fulfill({ status: 200, headers: CORS_HEADERS, json: fixture.agencies });
    }
    // Fleet phase (02) turned /vehicules into a real screen; serve the list
    // so a stray navigation there doesn't 404 into the error banner.
    if (method === "GET" && path === "/vehicles") {
      return route.fulfill({ status: 200, headers: CORS_HEADERS, json: [] });
    }
    // Clients phase (03) turned /clients into a real screen; serve the list
    // so a stray navigation there doesn't 404 into the error banner.
    if (method === "GET" && path === "/customers") {
      return route.fulfill({ status: 200, headers: CORS_HEADERS, json: [] });
    }
    // Contrats phase (04): the "/" landing (OPS-01 today) fans out per-vehicle
    // rental-contracts. Serve an empty list so the dashboard renders its
    // "nothing due today" state deterministically instead of 404-ing.
    if (method === "GET" && path.startsWith("/vehicles/") && path.endsWith("/rental-contracts")) {
      return route.fulfill({ status: 200, headers: CORS_HEADERS, json: [] });
    }
    return route.fulfill({
      status: 404,
      headers: CORS_HEADERS,
      json: { message: `unmocked e2e endpoint: ${method} ${pathname}` },
    });
  });

  return counts;
}

/** Drives the plan-05 login form and waits for the plan-06 shell to render. */
async function login(page: Page) {
  await page.goto("/login");
  await expect(page.getByText("Connexion")).toBeVisible();

  await page.locator("#login-email").fill(E2E_EMAIL);
  await page.locator("#login-password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();

  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("navigation", { name: "Navigation principale" }),
  ).toBeVisible();
}

const BASE_NAV_FR = ["Aujourd'hui", "Véhicules", "Clients", "Contrats", "États des lieux"];
const ADMIN_NAV_FR = ["Identité fiscale société", "Gestion agences", "Facturation transverse"];

test.describe("phase 01 happy path — login -> shell -> role-gated nav -> placeholder", () => {
  test("owner: logs in, sees full nav + admin sections + agency switcher, navigates to placeholders", async ({
    page,
  }) => {
    await mockApi(page, ownerFixture);
    await login(page);

    // Base nav — every destination present as a real link (no dead ends).
    for (const label of BASE_NAV_FR) {
      await expect(page.getByRole("link", { name: label })).toBeVisible();
    }
    // Owner (org admin): the 3 admin sections are visible (D-09).
    for (const label of ADMIN_NAV_FR) {
      await expect(page.getByRole("link", { name: label })).toBeVisible();
    }
    // Owner-only agency switcher, auto-selected to the first agency (D-10).
    const switcher = page.getByRole("button", { name: "Changer d'agence" });
    await expect(switcher).toBeVisible();
    await expect(switcher).toContainText("Agence Alger Centre");

    // The "/" landing is now the OPS-01 today overview (phase 04); with no
    // contracts due today the mock returns empty, so it shows its own empty
    // state rather than the generic placeholder.
    await expect(page.getByRole("heading", { name: "Aujourd'hui" })).toBeVisible();
    await expect(page.getByText("Rien de prévu aujourd'hui.")).toBeVisible();

    // Base section navigation. "États des lieux" became real in Phase 05, so
    // it now lands on the InspectionsIndex (its own empty state), not the
    // shared placeholder.
    await page.getByRole("link", { name: "États des lieux" }).click();
    await expect(page).toHaveURL("/etats-des-lieux");
    await expect(page.getByRole("heading", { name: "États des lieux" })).toBeVisible();
    await expect(page.getByText("Aucun contrat à inspecter")).toBeVisible();

    // Admin section navigation (owner-only segment) -> the shared empty state
    // (admin/* are the last remaining placeholders).
    await page.getByRole("link", { name: "Gestion agences" }).click();
    await expect(page).toHaveURL("/admin/agences");
    await expect(page.getByRole("heading", { name: "Bientôt disponible" })).toBeVisible();
  });

  test("agent: logs in, sees the identical base nav but NO admin sections and NO agency switcher", async ({
    page,
  }) => {
    await mockApi(page, agentFixture);
    await login(page);

    // Base nav is identical across roles (D-08).
    for (const label of BASE_NAV_FR) {
      await expect(page.getByRole("link", { name: label })).toBeVisible();
    }
    // Admin sections are fully absent — not disabled (D-09).
    for (const label of ADMIN_NAV_FR) {
      await expect(page.getByRole("link", { name: label })).toHaveCount(0);
    }
    // No agency switcher for a non-org-admin.
    await expect(page.getByRole("button", { name: "Changer d'agence" })).toHaveCount(0);

    // The real inspections index is reachable for the agent too (base nav).
    await page.getByRole("link", { name: "États des lieux" }).click();
    await expect(page).toHaveURL("/etats-des-lieux");
    await expect(page.getByRole("heading", { name: "États des lieux" })).toBeVisible();
  });

  test("owner: agency switch is in-place — no navigation reset, zero /me or /auth/refresh calls (D-10/D-11)", async ({
    page,
  }) => {
    const counts = await mockApi(page, ownerFixture);
    await login(page);

    const switcher = page.getByRole("button", { name: "Changer d'agence" });
    await expect(switcher).toContainText("Agence Alger Centre");

    const meCallsBefore = counts.me;
    const refreshCallsBefore = counts.refresh;

    await switcher.click();
    await page.getByRole("menuitem", { name: "Agence Oran Front de Mer" }).click();

    // In-place: the trigger reflects the new agency, the URL did not change.
    await expect(switcher).toContainText("Agence Oran Front de Mer");
    await expect(page).toHaveURL("/");

    // Zero additional session traffic (pure client state write).
    expect(counts.me).toBe(meCallsBefore);
    expect(counts.refresh).toBe(refreshCallsBefore);
  });

  test("language switcher: FR default everywhere, EN copy live after switch (AUTH-05)", async ({
    page,
  }) => {
    await mockApi(page, ownerFixture);
    await login(page);

    // "Gestion agences" (owner-only admin) is still a placeholder — use it for
    // the placeholder-copy locale check now that "États des lieux" is real.
    await page.getByRole("link", { name: "Gestion agences" }).click();
    await expect(page).toHaveURL("/admin/agences");
    // FR is the hard default with nothing stored.
    await expect(page.getByRole("heading", { name: "Bientôt disponible" })).toBeVisible();

    await page.getByRole("button", { name: "Changer de langue" }).click();

    // Same route, live-switched copy: placeholder + nav + chrome all EN.
    await expect(page).toHaveURL("/admin/agences");
    await expect(page.getByRole("heading", { name: "Coming soon" })).toBeVisible();
    await expect(
      page.getByText("This feature is coming in a future Wheelio update."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Vehicles" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Inspections" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Switch language" })).toBeVisible();
  });
});
