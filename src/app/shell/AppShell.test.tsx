/**
 * Component-level tests for AppShell — exercised standalone (a minimal
 * pathless-layout route tree + memory history, mirroring
 * auth-forms.test.tsx's `renderAtRoute` pattern) rather than through the
 * full `_authenticated` route guard, so loading/error/retry states can be
 * driven directly via MSW without needing a real login flow first.
 *
 * Covers this plan's must-have truths: the base nav is IDENTICAL across
 * agent/manager/owner (D-08); the 3 admin sections render ONLY for the
 * owner (org admin) and are fully absent — not disabled — otherwise (D-09);
 * a skeleton renders while `/me` resolves; a `/me` failure renders a
 * full-shell error banner + Retry (never a silently empty/guessed nav).
 */
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/mocks/server";
import { agentFixture, managerFixture, ownerFixture } from "@/test/fixtures/scope";
import { scopeFromMe } from "@/shared/auth/permissions";
import { resetSession } from "@/shared/auth/session";
import { useAuthStore } from "@/shared/auth/store";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { AppShell } from "./AppShell";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080/v1";

function resetAuthStore() {
  useAuthStore.setState({
    accessToken: null,
    accessTokenExpiresAt: null,
    refreshToken: null,
    scope: null,
    user: null,
    agencies: [],
    currentAgencyId: null,
  });
  localStorage.clear();
  resetSession();
}

/** Mounts AppShell inside a minimal pathless-layout route tree (mirrors the
 * real `_authenticated` -> `_authenticated/` nesting) so its <Outlet />
 * resolves without depending on the full app's routeTree.gen.ts. */
async function renderShell() {
  const queryClient = new QueryClient();
  const rootRoute = createRootRoute();
  const shellRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: "shell",
    component: AppShell,
  });
  const indexRoute = createRoute({
    getParentRoute: () => shellRoute,
    path: "/",
    component: () => <div>dashboard</div>,
  });
  const routeTree = rootRoute.addChildren([shellRoute.addChildren([indexRoute])]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await act(async () => {
    await router.load();
  });
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </QueryClientProvider>,
    );
  });
  return result;
}

describe("AppShell — role-gated nav", () => {
  beforeEach(resetAuthStore);
  afterEach(resetAuthStore);

  it("renders the base nav identically for agent, manager, and owner", async () => {
    for (const fixture of [agentFixture, managerFixture, ownerFixture]) {
      resetAuthStore();
      useAuthStore.getState().setScope(scopeFromMe(fixture.me));

      const { unmount } = await renderShell();

      expect(screen.getByText("Aujourd'hui")).toBeInTheDocument();
      expect(screen.getByText("Véhicules")).toBeInTheDocument();
      expect(screen.getByText("Clients")).toBeInTheDocument();
      expect(screen.getByText("Contrats")).toBeInTheDocument();
      expect(screen.getByText("États des lieux")).toBeInTheDocument();

      unmount();
    }
  });

  it("shows the 3 admin sections ONLY for the owner (org admin) — fully absent (not disabled) for agent/manager", async () => {
    useAuthStore.getState().setScope(scopeFromMe(agentFixture.me));
    const { unmount: unmountAgent } = await renderShell();
    expect(screen.queryByText("Identité fiscale société")).not.toBeInTheDocument();
    expect(screen.queryByText("Gestion agences")).not.toBeInTheDocument();
    expect(screen.queryByText("Facturation transverse")).not.toBeInTheDocument();
    unmountAgent();
    resetAuthStore();

    useAuthStore.getState().setScope(scopeFromMe(managerFixture.me));
    const { unmount: unmountManager } = await renderShell();
    expect(screen.queryByText("Identité fiscale société")).not.toBeInTheDocument();
    expect(screen.queryByText("Gestion agences")).not.toBeInTheDocument();
    expect(screen.queryByText("Facturation transverse")).not.toBeInTheDocument();
    unmountManager();
    resetAuthStore();

    useAuthStore.getState().setScope(scopeFromMe(ownerFixture.me));
    const { unmount: unmountOwner } = await renderShell();
    expect(screen.getByText("Identité fiscale société")).toBeInTheDocument();
    expect(screen.getByText("Gestion agences")).toBeInTheDocument();
    expect(screen.getByText("Facturation transverse")).toBeInTheDocument();
    unmountOwner();
  });
});

describe("AppShell — loading / error states", () => {
  beforeEach(resetAuthStore);
  afterEach(resetAuthStore);

  it("shows a loading skeleton while /me resolves, then the nav once it succeeds — never a guessed/empty nav", async () => {
    let resolveMe!: () => void;
    const mePromise = new Promise<void>((resolve) => {
      resolveMe = resolve;
    });
    server.use(
      http.get(`${API_URL}/me`, async () => {
        await mePromise;
        return HttpResponse.json(ownerFixture.me);
      }),
    );
    useAuthStore.setState({ accessToken: "already-have-one" });

    await renderShell();

    expect(screen.getByTestId("shell-skeleton")).toBeInTheDocument();
    expect(screen.queryByText("Aujourd'hui")).not.toBeInTheDocument();

    resolveMe();

    await waitFor(() => {
      expect(screen.getByText("Aujourd'hui")).toBeInTheDocument();
    });
  });

  it("shows a full-shell error banner + Retry when /me fails; Retry re-fetches and renders the nav on success", async () => {
    server.use(http.get(`${API_URL}/me`, () => new HttpResponse(null, { status: 500 })));
    useAuthStore.setState({ accessToken: "already-have-one" });

    const user = userEvent.setup();
    await renderShell();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/impossible de charger votre profil|couldn't load your profile/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("Aujourd'hui")).not.toBeInTheDocument();

    server.use(http.get(`${API_URL}/me`, () => HttpResponse.json(ownerFixture.me)));
    await user.click(screen.getByRole("button", { name: /réessayer|retry/i }));

    await waitFor(() => {
      expect(screen.getByText("Aujourd'hui")).toBeInTheDocument();
    });
  }, 10000);
});
