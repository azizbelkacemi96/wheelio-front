/**
 * Behavior tests for the rental wizard (RENT-05): step flow, trigger-gated
 * Next, lossless back/next, inline customer set, the not-authorized gate, and
 * the create→activate finish sequence landing on the contract detail.
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
import type { ReactNode } from "react";
import i18n from "@/shared/i18n";
import { server } from "@/test/mocks/server";
import { useAuthStore } from "@/shared/auth/store";
import { scopeFromMe } from "@/shared/auth/permissions";
import { ownerFixture } from "@/test/fixtures/scope";
import { vehicleAvailable } from "@/test/fixtures/fleet";
import { customerIndividualCin } from "@/test/fixtures/customers";
import { ContractWizard } from "./ContractWizard";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080/v1";
const CUSTOMER_NAME = customerIndividualCin.full_name!;

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

function renderWizard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: ContractWizard,
  });
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/contrats/$contractId",
    component: () => <div>detail-screen</div>,
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
  const { router, Harness } = renderWizard();
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
  return { router };
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

describe("ContractWizard", () => {
  it("renders step 1 with the progress indicator marking the vehicle step active", async () => {
    await mount();
    expect(await screen.findByText("Choisir un véhicule")).toBeInTheDocument();
    const active = document.querySelector('[aria-current="step"]');
    expect(active).toHaveTextContent("Véhicule");
  });

  it("blocks Next until a vehicle is selected, then advances to the customer step", async () => {
    const user = userEvent.setup();
    await mount();
    await screen.findByText("Choisir un véhicule");

    await user.click(screen.getByRole("button", { name: /suivant/i }));
    // Still on step 1 — no vehicle picked yet.
    expect(screen.getByText("Choisir un véhicule")).toBeInTheDocument();

    await user.click(
      await screen.findByRole("button", { name: new RegExp(vehicleAvailable.registration_plate) }),
    );
    await user.click(screen.getByRole("button", { name: /suivant/i }));
    expect(await screen.findByText("Choisir un client")).toBeInTheDocument();
  });

  it("preserves entered data when stepping back then forward (lossless nav)", async () => {
    const user = userEvent.setup();
    await mount();

    // step 1 → pick vehicle → next
    await user.click(
      await screen.findByRole("button", { name: new RegExp(vehicleAvailable.registration_plate) }),
    );
    await user.click(screen.getByRole("button", { name: /suivant/i }));
    // step 2 → pick existing customer → next
    await user.click(await screen.findByRole("button", { name: CUSTOMER_NAME }));
    await user.click(screen.getByRole("button", { name: /suivant/i }));
    // step 3 → enter dates
    const start = screen.getByLabelText("Début");
    await user.type(start, "2026-08-01T09:00");
    // back to step 1, then forward again
    await user.click(screen.getByRole("button", { name: /précédent/i }));
    await user.click(screen.getByRole("button", { name: /précédent/i }));
    expect(await screen.findByText("Choisir un véhicule")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /suivant/i }));
    await user.click(screen.getByRole("button", { name: /suivant/i }));
    // step 3 value retained
    expect(screen.getByLabelText("Début")).toHaveValue("2026-08-01T09:00");
  });

  it("runs the create → activate finish sequence and lands on the contract detail", async () => {
    const user = userEvent.setup();
    let created = 0;
    let activated = 0;
    server.use(
      http.post(`${API_URL}/vehicles/:vehicleId/rental-contracts`, async () => {
        created += 1;
        return HttpResponse.json(
          {
            id: "ctr-new-1",
            vehicle_id: vehicleAvailable.id,
            customer_id: customerIndividualCin.id,
            status: "reserved",
            starts_at: "2026-08-01T09:00:00+01:00",
            ends_at: "2026-08-05T09:00:00+01:00",
            created_at: "2026-08-01T00:00:00Z",
            updated_at: "2026-08-01T00:00:00Z",
          },
          { status: 201 },
        );
      }),
      http.post(`${API_URL}/rental-contracts/:id/activate`, async () => {
        activated += 1;
        return HttpResponse.json({ id: "ctr-new-1", status: "active" }, { status: 200 });
      }),
    );

    await mount();
    // step 1
    await user.click(
      await screen.findByRole("button", { name: new RegExp(vehicleAvailable.registration_plate) }),
    );
    await user.click(screen.getByRole("button", { name: /suivant/i }));
    // step 2
    await user.click(await screen.findByRole("button", { name: CUSTOMER_NAME }));
    await user.click(screen.getByRole("button", { name: /suivant/i }));
    // step 3 dates
    await user.type(screen.getByLabelText("Début"), "2026-08-01T09:00");
    await user.type(screen.getByLabelText("Fin"), "2026-08-05T09:00");
    await user.click(screen.getByRole("button", { name: /suivant/i }));
    // step 4 departure
    await user.type(screen.getByLabelText("Kilométrage de départ"), "15000");
    await user.click(screen.getByLabelText("Niveau de carburant"));
    await user.click(await screen.findByRole("option", { name: "Plein" }));
    // finish
    await user.click(screen.getByRole("button", { name: /terminer/i }));

    await waitFor(() => expect(screen.getByText("detail-screen")).toBeInTheDocument());
    expect(created).toBe(1);
    expect(activated).toBe(1);
  });

  it("renders the not-authorized state for a scope below agent role", async () => {
    useAuthStore.setState({
      scope: {
        userId: "u1",
        orgId: "o1",
        orgRole: "member",
        agencyRoles: { "agency-x": "viewer" },
      },
    });
    await mount();
    expect(
      await screen.findByText("Vous n'avez pas les droits nécessaires pour cette action."),
    ).toBeInTheDocument();
  });
});
