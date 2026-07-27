/**
 * Behavior tests for the /vehicules list screen (FLEET-01, D-01/D-03/D-09).
 *
 * Driven through the shared MSW handlers + a fresh QueryClient (retry: false)
 * and a minimal memory-history router that registers /vehicules/$vehicleId so
 * the per-row plate <Link> resolves an href without the full app tree.
 *
 * Covers every line of the plan's behavior block: full-fixture rendering with
 * plate/brand-model/status-badge/mileage/fuel-type/agency; server-side status
 * filter (?status=) vs client-side text search (no network); the D-09 state
 * quartet (skeleton / error+retry / empty / no-results); the owner-only agency
 * column; and the plate→detail link target.
 */
import { delay, http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
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
  vehicleAvailable,
  vehicleFixtures,
  vehicleMaintenance,
  vehicleRented,
  vehicleRetired,
} from "@/test/fixtures/fleet";
import { VehicleList } from "./VehicleList";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080/v1";

/** fr locale mileage formatting, matching the component's useLocale() output. */
const kmText = (n: number) => new RegExp(`${n.toLocaleString("fr").replace(/\D/g, "\\D?")}\\s*km`);

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

function renderList() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: VehicleList,
  });
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/vehicules/$vehicleId",
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
  return { queryClient, router, Harness };
}

async function mount() {
  const { router, Harness } = renderList();
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
  // Owner view: agencies loaded (agency column visible), no current agency
  // selected yet → the list query fetches the whole fixture set (all 5).
  useAuthStore.setState({ agencies: ownerFixture.agencies, currentAgencyId: null });
});

afterEach(async () => {
  resetAuthStore();
  await act(async () => {
    await i18n.changeLanguage("fr");
  });
});

describe("VehicleList", () => {
  it("renders every fixture vehicle as a table row with plate, brand/model, status badge, mileage, fuel type, and agency", async () => {
    await mount();
    const table = await screen.findByRole("table");

    // one data row per fixture (+1 header row)
    expect(within(table).getAllByRole("row")).toHaveLength(vehicleFixtures.length + 1);

    // plate + brand/model
    expect(within(table).getByText(vehicleAvailable.registration_plate)).toBeInTheDocument();
    expect(within(table).getByText(/Renault Clio 5/)).toBeInTheDocument();
    expect(within(table).getByText(/Dacia Sandero Stepway/)).toBeInTheDocument();

    // all four status enum values render as translated badges
    expect(within(table).getAllByText("Disponible").length).toBeGreaterThan(0);
    expect(within(table).getByText("Loué")).toBeInTheDocument();
    expect(within(table).getByText("En maintenance")).toBeInTheDocument();
    expect(within(table).getByText("Retiré")).toBeInTheDocument();

    // locale-formatted mileage + km unit
    expect(within(table).getByText(kmText(vehicleAvailable.current_mileage))).toBeInTheDocument();

    // translated fuel TYPE (not fuel level)
    expect(within(table).getAllByText("Essence").length).toBeGreaterThan(0); // petrol
    expect(within(table).getByText("Diesel")).toBeInTheDocument();
    expect(within(table).getByText("Hybride")).toBeInTheDocument();

    // agency names resolved client-side from the auth store (both agencies present)
    expect(within(table).getAllByText("Agence Alger Centre").length).toBeGreaterThan(0);
    expect(within(table).getAllByText("Agence Oran Front de Mer").length).toBeGreaterThan(0);
  });

  it("selecting a status refetches the list with ?status={value}; clearing back to 'all' drops the param", async () => {
    const user = userEvent.setup();
    const urls: string[] = [];
    server.use(
      http.get(`${API_URL}/vehicles`, ({ request }) => {
        urls.push(request.url);
        const status = new URL(request.url).searchParams.get("status");
        const data = status
          ? vehicleFixtures.filter((v) => v.status === status)
          : vehicleFixtures;
        return HttpResponse.json(data);
      }),
    );
    await mount();
    await screen.findByRole("table");

    await user.click(screen.getByRole("combobox", { name: /filtrer par statut/i }));
    await user.click(await screen.findByRole("option", { name: "Loué" }));

    await waitFor(() => {
      expect(urls.some((u) => new URL(u).searchParams.get("status") === "rented")).toBe(true);
    });

    await user.click(screen.getByRole("combobox", { name: /filtrer par statut/i }));
    await user.click(await screen.findByRole("option", { name: /tous les statuts/i }));

    await waitFor(() => {
      const last = urls[urls.length - 1];
      expect(new URL(last).searchParams.has("status")).toBe(false);
    });
  });

  it("typing a plate/brand/model fragment filters rows client-side with NO new request", async () => {
    const user = userEvent.setup();
    let requestCount = 0;
    server.use(
      http.get(`${API_URL}/vehicles`, () => {
        requestCount += 1;
        return HttpResponse.json(vehicleFixtures);
      }),
    );
    await mount();
    await screen.findByRole("table");
    const initialRequests = requestCount;

    await user.type(screen.getByRole("searchbox"), "sandero");

    await waitFor(() => {
      const table = screen.getByRole("table");
      expect(within(table).getByText(vehicleRented.registration_plate)).toBeInTheDocument();
      expect(
        within(table).queryByText(vehicleAvailable.registration_plate),
      ).not.toBeInTheDocument();
    });
    expect(requestCount).toBe(initialRequests);
  });

  it("shows the distinct noResults copy (not the EmptyState) when a filter matches nothing", async () => {
    const user = userEvent.setup();
    await mount();
    await screen.findByRole("table");

    await user.type(screen.getByRole("searchbox"), "zzz-no-such-vehicle");

    await waitFor(() => {
      expect(screen.getByText(/aucun véhicule ne correspond à votre recherche/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    // NOT the true-empty EmptyState body
    expect(screen.queryByText(/aucun véhicule n'est enregistré/i)).not.toBeInTheDocument();
  });

  it("renders skeleton rows while the query is pending", async () => {
    server.use(
      http.get(`${API_URL}/vehicles`, async () => {
        await delay(60);
        return HttpResponse.json(vehicleFixtures);
      }),
    );
    await mount();
    expect(screen.getByTestId("vehicle-list-loading")).toBeInTheDocument();
    await screen.findByRole("table");
  });

  it("shows an inline error banner with a working Réessayer button on a fetch failure", async () => {
    const user = userEvent.setup();
    // 500 on every call so ky's built-in retry can't turn the initial fetch
    // into a success — the query resolves to isError (AppShell meError pattern).
    server.use(
      http.get(`${API_URL}/vehicles`, () => new HttpResponse(null, { status: 500 })),
    );
    await mount();

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument(), {
      timeout: 5000,
    });
    expect(screen.getByText(/impossible de charger les véhicules/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    // Recovery: swap in a healthy handler, then Réessayer refetches + renders.
    server.use(http.get(`${API_URL}/vehicles`, () => HttpResponse.json(vehicleFixtures)));
    await user.click(screen.getByRole("button", { name: /réessayer/i }));

    const table = await screen.findByRole("table");
    expect(within(table).getByText(vehicleAvailable.registration_plate)).toBeInTheDocument();
  }, 15000);

  it("renders the EmptyState when the API returns zero vehicles", async () => {
    server.use(http.get(`${API_URL}/vehicles`, () => HttpResponse.json([])));
    await mount();

    await waitFor(() => {
      expect(screen.getByText(/aucun véhicule n'est enregistré/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "Aucun véhicule" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("omits the agency column when the auth store has no agencies (non-admin)", async () => {
    useAuthStore.setState({ agencies: [], currentAgencyId: null });
    await mount();
    const table = await screen.findByRole("table");

    expect(within(table).queryByText("Agence")).not.toBeInTheDocument();
    expect(within(table).queryByText("Agence Alger Centre")).not.toBeInTheDocument();
  });

  it("links each row's plate to /vehicules/{id}", async () => {
    await mount();
    const table = await screen.findByRole("table");
    const link = within(table).getByRole("link", {
      name: vehicleAvailable.registration_plate,
    });
    expect(link).toHaveAttribute("href", `/vehicules/${vehicleAvailable.id}`);
  });

  it("also renders a mobile card stack mirroring the rows (both table and cards in the DOM)", async () => {
    await mount();
    await screen.findByRole("table");
    const cards = screen.getByTestId("vehicle-card-stack");
    expect(within(cards).getByText(vehicleRetired.registration_plate)).toBeInTheDocument();
    expect(within(cards).getByText(vehicleMaintenance.registration_plate)).toBeInTheDocument();
  });

  it("shows the filtered vehicle count via the plural key", async () => {
    const user = userEvent.setup();
    await mount();
    await screen.findByRole("table");

    expect(screen.getByText(`${vehicleFixtures.length} véhicules`)).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox"), "sandero");
    await waitFor(() => expect(screen.getByText("1 véhicule")).toBeInTheDocument());
  });
});
