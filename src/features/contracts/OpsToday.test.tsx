/**
 * Behavior tests for the OPS-01 today overview at `/`. Uses the shared MSW
 * handlers (which serve the dynamically-"today" reservedTodayContract +
 * activeEndingTodayContract fixtures), so pickups/returns populate without
 * pinning a clock. Covers populated, empty, and error states.
 */
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import i18n from "@/shared/i18n";
import { server } from "@/test/mocks/server";
import { useAuthStore } from "@/shared/auth/store";
import { scopeFromMe } from "@/shared/auth/permissions";
import { ownerFixture } from "@/test/fixtures/scope";
import { vehicleAvailable, vehicleRented } from "@/test/fixtures/fleet";
import { customerIndividualCin, customerCompany } from "@/test/fixtures/customers";
import { OpsToday } from "./OpsToday";

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
}

function renderOps() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: OpsToday,
  });
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/contrats/$contractId",
    component: () => <div>detail</div>,
  });
  const routeTree = rootRoute.addChildren([indexRoute, detailRoute]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  function Harness({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { router, Harness };
}

async function mount() {
  const { router, Harness } = renderOps();
  await act(async () => {
    await router.load();
  });
  await act(async () => {
    render(
      <Harness>
        <RouterProvider router={router} />
      </Harness>,
    );
  });
}

beforeEach(() => {
  resetAuthStore();
  useAuthStore.setState({ scope: scopeFromMe(ownerFixture.me) });
});

afterEach(async () => {
  resetAuthStore();
  await act(async () => {
    await i18n.changeLanguage("fr");
  });
});

describe("OpsToday", () => {
  it("shows today's pickups and returns with resolved plate + customer name", async () => {
    await mount();

    // Pickup: reservedTodayContract on vehicleAvailable for the CIN individual.
    await waitFor(() =>
      expect(screen.getByText(vehicleAvailable.registration_plate)).toBeInTheDocument(),
    );
    expect(screen.getByText(customerIndividualCin.full_name!)).toBeInTheDocument();
    // Return: activeEndingTodayContract on vehicleRented for the company.
    expect(screen.getByText(vehicleRented.registration_plate)).toBeInTheDocument();
    expect(screen.getByText(customerCompany.legal_name!)).toBeInTheDocument();

    expect(screen.getByText("Départs du jour")).toBeInTheDocument();
    expect(screen.getByText("Retours du jour")).toBeInTheDocument();
  });

  it("shows the both-empty message when nothing is due today", async () => {
    server.use(http.get(`${API_URL}/vehicles`, () => HttpResponse.json([])));
    await mount();
    await waitFor(() =>
      expect(screen.getByText("Rien de prévu aujourd'hui.")).toBeInTheDocument(),
    );
  });

  it("shows an error state when the vehicles fan-out fails", async () => {
    server.use(http.get(`${API_URL}/vehicles`, () => new HttpResponse(null, { status: 500 })));
    await mount();
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByText("Impossible de charger les contrats.")).toBeInTheDocument();
  });
});
