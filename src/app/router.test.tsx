/**
 * Integration tests for the real `_authenticated` route guard (imported via
 * the app's own `routeTree.gen.ts`, not an ad hoc route tree) driven through
 * MSW: a successful refresh renders the shell with no redirect; a failed
 * refresh redirects to /login with the "Session expirée" copy — the ONE
 * redirect path AUTH-02 allows.
 */
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { routeTree } from "@/routeTree.gen";
import { server } from "@/test/mocks/server";
import { resetSession, ensureSession } from "@/shared/auth/session";
import { useAuthStore } from "@/shared/auth/store";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { vehicleAvailable } from "@/test/fixtures/fleet";
import { customerIndividualCin } from "@/test/fixtures/customers";

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

async function renderApp(initialEntries: string[]) {
  const queryClient = new QueryClient();
  const router = createRouter({
    routeTree,
    context: { auth: { ensureSession } },
    history: createMemoryHistory({ initialEntries }),
  });
  let result!: ReturnType<typeof render>;
  // Deliberately do NOT pre-load the router before mounting (unlike
  // auth-forms.test.tsx's synchronous 3-route tree): the redirected /login
  // route's own "Session expirée" toast fires from a mount effect, which
  // only reaches a subscriber once RootComponent's <Toaster/> is mounted —
  // matching how the real app boots (RouterProvider triggers the initial
  // load after mount, not before).
  await act(async () => {
    result = render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </QueryClientProvider>,
    );
  });
  return { ...result, router };
}

describe("_authenticated route guard", () => {
  beforeEach(resetAuthStore);
  afterEach(resetAuthStore);

  it("refresh success: renders the shell at '/' with no redirect", async () => {
    useAuthStore.setState({ refreshToken: "valid-refresh-token" });

    const { router } = await renderApp(["/"]);

    await waitFor(() => {
      expect(screen.getAllByText("Aujourd'hui").length).toBeGreaterThan(0);
    });
    expect(router.state.location.pathname).toBe("/");
    expect(useAuthStore.getState().scope).not.toBeNull();
  });

  it("navigating to /vehicules renders the real vehicle list, not the retired placeholder", async () => {
    useAuthStore.setState({ refreshToken: "valid-refresh-token" });

    const { router } = await renderApp(["/vehicules"]);

    // The real list screen: its "Véhicules" page heading + fixture rows from
    // the plan 02-01 vehicles MSW handler. The Phase 1 placeholder's "Bientôt
    // disponible" empty state must be gone.
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Véhicules" }),
      ).toBeInTheDocument();
    });
    await waitFor(() => {
      // Rendered in both the desktop table and the mobile card stack (both in
      // the DOM; CSS controls visibility) — assert at least one instance.
      expect(
        screen.getAllByText(vehicleAvailable.registration_plate).length,
      ).toBeGreaterThan(0);
    });
    expect(screen.queryByText("Bientôt disponible")).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/vehicules");
  });

  it("navigating to /clients renders the real customer list, not the retired placeholder", async () => {
    useAuthStore.setState({ refreshToken: "valid-refresh-token" });

    const { router } = await renderApp(["/clients"]);

    // The real list screen: its "Clients" page heading. The Phase 1
    // placeholder's "Bientôt disponible" empty state must be gone.
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Clients" }),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("Bientôt disponible")).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/clients");
  });

  it("navigating to /vehicules/{id} resolves the detail screen through the real route tree", async () => {
    useAuthStore.setState({ refreshToken: "valid-refresh-token" });

    const { router } = await renderApp([`/vehicules/${vehicleAvailable.id}`]);

    // The detail screen renders the vehicle's plate as its page heading,
    // proving list -> detail routing works end-to-end via the generated tree
    // + the plan 02-01 vehicles MSW handler.
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: vehicleAvailable.registration_plate }),
      ).toBeInTheDocument();
    });
    expect(router.state.location.pathname).toBe(
      `/vehicules/${vehicleAvailable.id}`,
    );
  });

  it("navigating to /clients/{id} resolves the detail screen through the real route tree", async () => {
    useAuthStore.setState({ refreshToken: "valid-refresh-token" });

    const { router } = await renderApp([`/clients/${customerIndividualCin.id}`]);

    // The detail screen renders the customer's full name as its page heading,
    // proving list/form -> detail routing works end-to-end via the generated
    // tree + the plan 03-01 customer MSW handler.
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: customerIndividualCin.full_name }),
      ).toBeInTheDocument();
    });
    expect(router.state.location.pathname).toBe(
      `/clients/${customerIndividualCin.id}`,
    );
  });

  it("refresh failure: redirects to /login and shows the 'Session expirée' copy", async () => {
    server.use(
      http.post(`${API_URL}/auth/refresh`, () => new HttpResponse(null, { status: 401 })),
    );
    useAuthStore.setState({ refreshToken: "stale-refresh-token" });

    const { router } = await renderApp(["/"]);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
    });
    await waitFor(() => {
      expect(
        screen.getByText(/session expirée|session expired/i),
      ).toBeInTheDocument();
    });
    expect(useAuthStore.getState().scope).toBeNull();
  });
});
