/**
 * Behavior tests for the /vehicules/$vehicleId detail screen (FLEET-02,
 * D-04/D-09).
 *
 * Driven through the shared MSW handlers + a fresh QueryClient (retry: false)
 * and a minimal memory-history router that registers /vehicules so the
 * back-to-list <Link> resolves an href without the full app tree.
 *
 * Covers every line of the plan's behavior block: the full vehicle card
 * (plate/brand-model/mileage/fuel-type/transmission/status-badge);
 * presence-guarded optional fields (model_year/color/seats/notes) that never
 * render "undefined"; the current-contract card (period, translated status,
 * departure mileage, translated departure fuel LEVEL); the noCurrentContract
 * state on an empty contracts array; the not-found state on a 404; the
 * vehicle-query loading/error(+retry) states; and the contract-only error
 * that must NOT blank the page.
 */
import { http, HttpResponse, delay } from "msw";
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
import { ownerFixture } from "@/test/fixtures/scope";
import {
  activeContractFixture,
  vehicleAvailable,
  vehicleBare,
  vehicleRented,
} from "@/test/fixtures/fleet";
import { VehicleDetail } from "./VehicleDetail";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080/v1";

/** fr locale numeric formatting, matching the component's useLocale() output. */
const kmText = (n: number) =>
  new RegExp(`${n.toLocaleString("fr").replace(/\D/g, "\\D?")}\\s*km`);

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

function buildHarness(vehicleId: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <VehicleDetail vehicleId={vehicleId} />,
  });
  const listRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/vehicules",
    component: () => <div>list</div>,
  });
  const routeTree = rootRoute.addChildren([indexRoute, listRoute]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  function Harness({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, router, Harness };
}

async function mount(vehicleId: string) {
  const { router, Harness } = buildHarness(vehicleId);
  await act(async () => {
    await router.load();
  });
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <Harness>
        <RouterProvider router={router} />
      </Harness>,
    );
  });
  return { ...result, router };
}

beforeEach(() => {
  resetAuthStore();
  useAuthStore.setState({ agencies: ownerFixture.agencies, currentAgencyId: null });
});

afterEach(async () => {
  resetAuthStore();
  await act(async () => {
    await i18n.changeLanguage("fr");
  });
});

describe("VehicleDetail", () => {
  it("renders the vehicle card: plate heading, brand/model, mileage, translated fuel type, transmission, and status badge", async () => {
    await mount(vehicleRented.id);

    // plate is the page heading
    expect(
      await screen.findByRole("heading", { name: vehicleRented.registration_plate }),
    ).toBeInTheDocument();

    // brand + model (+ model_year) subline
    expect(screen.getByText(/Dacia Sandero Stepway/)).toBeInTheDocument();

    // locale-formatted mileage + km unit
    expect(
      screen.getByText(kmText(vehicleRented.current_mileage)),
    ).toBeInTheDocument();

    // translated fuel TYPE (diesel) — the vehicle card never shows a fuel LEVEL
    expect(screen.getByText("Diesel")).toBeInTheDocument();

    // translated transmission (manual)
    expect(screen.getByText("Manuelle")).toBeInTheDocument();

    // VIN
    expect(screen.getByText(vehicleRented.vin)).toBeInTheDocument();

    // status badge (rented -> "Loué")
    expect(screen.getByText("Loué")).toBeInTheDocument();
  });

  it("renders optional fields when present (model_year, color, seats, notes)", async () => {
    await mount(vehicleAvailable.id);

    await screen.findByRole("heading", {
      name: vehicleAvailable.registration_plate,
    });

    expect(screen.getByText(String(vehicleAvailable.model_year))).toBeInTheDocument();
    expect(screen.getByText(vehicleAvailable.color!)).toBeInTheDocument();
    expect(screen.getByText(String(vehicleAvailable.seats))).toBeInTheDocument();
    expect(screen.getByText(vehicleAvailable.notes!)).toBeInTheDocument();
  });

  it("omits absent optional fields — never renders the string 'undefined'", async () => {
    const { container } = await mount(vehicleBare.id);

    await screen.findByRole("heading", { name: vehicleBare.registration_plate });

    // omitempty-absent keys: their labels do not appear
    expect(screen.queryByText("Couleur")).not.toBeInTheDocument();
    expect(screen.queryByText("Places")).not.toBeInTheDocument();
    expect(screen.queryByText("Notes")).not.toBeInTheDocument();
    // model_year absent on vehicleBare -> the "Année" row is not rendered
    expect(screen.queryByText("Année")).not.toBeInTheDocument();

    // nothing rendered the literal "undefined"
    expect(container.textContent).not.toMatch(/undefined/);
  });

  it("renders the current-contract card with period, translated status, departure mileage, and departure fuel level", async () => {
    await mount(vehicleRented.id);

    // card heading
    expect(
      await screen.findByText("Contrat en cours", { selector: "*" }),
    ).toBeInTheDocument();

    // translated contract status (active -> "En cours")
    expect(await screen.findByText("En cours")).toBeInTheDocument();

    // departure mileage (numeric, fr-formatted) + km
    expect(
      screen.getByText(kmText(activeContractFixture.departure_mileage!)),
    ).toBeInTheDocument();

    // translated departure fuel LEVEL (three_quarters -> "3/4") — the ONLY
    // fuel-level reading the API has
    expect(screen.getByText("3/4")).toBeInTheDocument();

    // period label present
    expect(screen.getByText("Période")).toBeInTheDocument();
  });

  it("shows the noCurrentContract copy when the contracts endpoint returns []", async () => {
    await mount(vehicleAvailable.id);

    await screen.findByRole("heading", {
      name: vehicleAvailable.registration_plate,
    });

    expect(await screen.findByText("Aucun contrat en cours")).toBeInTheDocument();
    // no invented status/fuel from vehicle.status
    expect(screen.queryByText("3/4")).not.toBeInTheDocument();
  });

  it("renders the not-found state with a working back link for an unknown vehicle id", async () => {
    await mount("00000000-0000-4000-8000-000000000000");

    expect(await screen.findByText("Véhicule introuvable")).toBeInTheDocument();
    expect(
      screen.getByText(/n'existe pas ou n'est plus accessible/i),
    ).toBeInTheDocument();

    const back = screen.getByRole("link", { name: /retour aux véhicules/i });
    expect(back).toHaveAttribute("href", "/vehicules");
  });

  it("renders skeletons while the vehicle query is pending", async () => {
    server.use(
      http.get(`${API_URL}/vehicles/:vehicleId`, async () => {
        await delay(60);
        return HttpResponse.json(vehicleRented);
      }),
    );
    await mount(vehicleRented.id);
    expect(screen.getByTestId("vehicle-detail-loading")).toBeInTheDocument();
    await screen.findByRole("heading", { name: vehicleRented.registration_plate });
  });

  it("shows the vehicle load-error banner with a working retry on a 500", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(
        `${API_URL}/vehicles/:vehicleId`,
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    await mount(vehicleRented.id);

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument(), {
      timeout: 5000,
    });
    expect(
      screen.getByText(/impossible de charger les véhicules/i),
    ).toBeInTheDocument();

    // Recovery: healthy handler, then Réessayer refetches + renders the card.
    server.use(
      http.get(`${API_URL}/vehicles/:vehicleId`, () =>
        HttpResponse.json(vehicleRented),
      ),
    );
    await user.click(screen.getByRole("button", { name: /réessayer/i }));

    await screen.findByRole("heading", { name: vehicleRented.registration_plate });
  }, 15000);

  it("shows the contract load-error inline in the card WITHOUT blanking the page when only the contract query fails", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(
        `${API_URL}/vehicles/:vehicleId/rental-contracts`,
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    await mount(vehicleRented.id);

    // the vehicle card still renders (page not blanked)
    await screen.findByRole("heading", { name: vehicleRented.registration_plate });

    // contract card shows its inline error + retry
    expect(
      await screen.findByText(/impossible de charger le contrat en cours/i),
    ).toBeInTheDocument();

    // recover the contract endpoint and retry inside the card
    server.use(
      http.get(`${API_URL}/vehicles/:vehicleId/rental-contracts`, () =>
        HttpResponse.json([activeContractFixture]),
      ),
    );
    await user.click(screen.getByRole("button", { name: /réessayer/i }));

    expect(await screen.findByText("En cours")).toBeInTheDocument();
  }, 15000);
});
