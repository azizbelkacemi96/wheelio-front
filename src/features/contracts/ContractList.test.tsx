/**
 * Behavior tests for the /contrats list screen (RENT-01..04, D-02).
 *
 * Driven through the shared MSW handlers + a fresh QueryClient (retry: false)
 * and a minimal memory-history router that registers /contrats/$contractId +
 * /contrats/nouveau so the per-row plate <Link> and the CTA <Link> resolve an
 * href without the full app tree.
 *
 * The list is COMPOSED CLIENT-SIDE from the 04-01 fan-out (useAllContractsQuery
 * over the vehicles + per-vehicle rental-contracts) — never a single list-all
 * fetch. The default fixtures span all four statuses across two vehicles, so
 * one composed render exercises the whole id->plate/customer join. Both the
 * status filter and the text search are asserted as CLIENT-side narrowings
 * over the already-composed array (no new request).
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
import { scopeFromMe } from "@/shared/auth/permissions";
import { ownerFixture } from "@/test/fixtures/scope";
import { vehicleAvailable, vehicleRented } from "@/test/fixtures/fleet";
import {
  customerCompany,
  customerIndividualCin,
} from "@/test/fixtures/customers";
import { contractFixtures } from "@/test/fixtures/contracts";
import { ContractList } from "./ContractList";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080/v1";

const CUSTOMER_CIN_NAME = customerIndividualCin.full_name!;
const CUSTOMER_COMPANY_NAME = customerCompany.legal_name!;

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
    component: ContractList,
  });
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/contrats/$contractId",
    component: () => <div>detail</div>,
  });
  const nouveauRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/contrats/nouveau",
    component: () => <div>nouveau</div>,
  });
  const routeTree = rootRoute.addChildren([
    indexRoute,
    detailRoute,
    nouveauRoute,
  ]);
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
});

afterEach(async () => {
  resetAuthStore();
  await act(async () => {
    await i18n.changeLanguage("fr");
  });
});

describe("ContractList — composed list + id->name join", () => {
  it("renders one row per composed contract with plate, customer name, period, and a status badge for each status", async () => {
    await mount();
    const table = await screen.findByRole("table");

    // 8 fixture contracts across two vehicles + 1 header row.
    expect(within(table).getAllByRole("row")).toHaveLength(
      contractFixtures.length + 1,
    );

    // plates joined from the vehicles (both vehicles that carry contracts).
    expect(
      within(table).getAllByText(vehicleAvailable.registration_plate).length,
    ).toBeGreaterThan(0);
    expect(
      within(table).getAllByText(vehicleRented.registration_plate).length,
    ).toBeGreaterThan(0);

    // customer names joined from the customers list.
    expect(within(table).getAllByText(CUSTOMER_CIN_NAME).length).toBeGreaterThan(0);
    expect(within(table).getAllByText(CUSTOMER_COMPANY_NAME).length).toBeGreaterThan(0);

    // all four status enum values render as translated badges (never raw enums).
    expect(within(table).getAllByText("Réservé").length).toBeGreaterThan(0);
    expect(within(table).getAllByText("En cours").length).toBeGreaterThan(0);
    expect(within(table).getByText("Clôturé")).toBeInTheDocument();
    expect(within(table).getByText("Annulé")).toBeInTheDocument();

    // a period range (locale-formatted start – end) is present.
    const startFr = new Date(vehicleAvailable ? contractFixtures[0].starts_at : "").toLocaleDateString("fr");
    expect(within(table).getAllByText(new RegExp(startFr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).length).toBeGreaterThan(0);
  });

  it("renders an em dash for a contract whose customer can't be joined (never crashes)", async () => {
    // activeContractFixture points at customer 7777… which is NOT in the
    // customers list, so its customer cell falls back to the em dash.
    await mount();
    const table = await screen.findByRole("table");
    expect(within(table).getAllByText("—").length).toBeGreaterThan(0);
  });

  it("makes NO call to a list-all endpoint — the list is composed from the per-vehicle fan-out only", async () => {
    const urls: string[] = [];
    server.use(
      http.get(`${API_URL}/vehicles/:vehicleId/rental-contracts`, ({ request, params }) => {
        urls.push(request.url);
        const contracts = contractFixtures.filter(
          (c) => c.vehicle_id === params.vehicleId,
        );
        return HttpResponse.json(contracts);
      }),
      // A list-all endpoint does not exist — assert it is never hit.
      http.get(`${API_URL}/contracts`, () => {
        throw new Error("list-all /contracts endpoint must never be called");
      }),
      http.get(`${API_URL}/rental-contracts`, () => {
        throw new Error("list-all /rental-contracts endpoint must never be called");
      }),
    );
    await mount();
    await screen.findByRole("table");
    // The composition fanned out per-vehicle (one request per vehicle id).
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every((u) => u.includes("/rental-contracts"))).toBe(true);
  });
});

describe("ContractList — status filter + text search (client-side)", () => {
  it("narrows the composed list to a single status with NO new request", async () => {
    const user = userEvent.setup();
    let listRequests = 0;
    server.use(
      http.get(`${API_URL}/vehicles/:vehicleId/rental-contracts`, ({ params }) => {
        listRequests += 1;
        const contracts = contractFixtures.filter(
          (c) => c.vehicle_id === params.vehicleId,
        );
        return HttpResponse.json(contracts);
      }),
    );
    await mount();
    await screen.findByRole("table");
    const afterLoad = listRequests;

    await user.click(screen.getByRole("combobox", { name: /statut/i }));
    await user.click(await screen.findByRole("option", { name: "Clôturés" }));

    await waitFor(() => {
      const table = screen.getByRole("table");
      // only the single closed contract remains (1 data + 1 header row).
      expect(within(table).getAllByRole("row")).toHaveLength(2);
      expect(within(table).getByText("Clôturé")).toBeInTheDocument();
      expect(within(table).queryByText("Réservé")).not.toBeInTheDocument();
    });
    // client-side filter — no additional network round-trip.
    expect(listRequests).toBe(afterLoad);
  });

  it("filters by plate fragment client-side with NO new request", async () => {
    const user = userEvent.setup();
    let listRequests = 0;
    server.use(
      http.get(`${API_URL}/vehicles/:vehicleId/rental-contracts`, ({ params }) => {
        listRequests += 1;
        const contracts = contractFixtures.filter(
          (c) => c.vehicle_id === params.vehicleId,
        );
        return HttpResponse.json(contracts);
      }),
    );
    await mount();
    await screen.findByRole("table");
    const afterLoad = listRequests;

    await user.type(screen.getByRole("searchbox"), vehicleRented.registration_plate);

    await waitFor(() => {
      const table = screen.getByRole("table");
      expect(
        within(table).getAllByText(vehicleRented.registration_plate).length,
      ).toBeGreaterThan(0);
      expect(
        within(table).queryByText(vehicleAvailable.registration_plate),
      ).not.toBeInTheDocument();
    });
    expect(listRequests).toBe(afterLoad);
  });

  it("filters by customer name fragment client-side", async () => {
    const user = userEvent.setup();
    await mount();
    await screen.findByRole("table");

    await user.type(screen.getByRole("searchbox"), CUSTOMER_CIN_NAME);

    await waitFor(() => {
      const table = screen.getByRole("table");
      expect(within(table).getAllByText(CUSTOMER_CIN_NAME).length).toBeGreaterThan(0);
      expect(within(table).queryByText(CUSTOMER_COMPANY_NAME)).not.toBeInTheDocument();
    });
  });

  it("a status filter matching zero rows shows noResults AND keeps the filter control mounted (CR-01)", async () => {
    const user = userEvent.setup();
    // Return no closed contracts so the 'Clôturés' filter yields zero rows.
    server.use(
      http.get(`${API_URL}/vehicles/:vehicleId/rental-contracts`, ({ params }) => {
        const contracts = contractFixtures.filter(
          (c) => c.vehicle_id === params.vehicleId && c.status !== "closed",
        );
        return HttpResponse.json(contracts);
      }),
    );
    await mount();
    await screen.findByRole("table");

    await user.click(screen.getByRole("combobox", { name: /statut/i }));
    await user.click(await screen.findByRole("option", { name: "Clôturés" }));

    await waitFor(() => {
      expect(
        screen.getByText(/aucun contrat ne correspond à votre recherche/i),
      ).toBeInTheDocument();
    });
    // NOT the true-empty EmptyState.
    expect(screen.queryByText(/aucun contrat de location n'a encore été créé/i)).not.toBeInTheDocument();
    // The Select is still mounted — the user can clear the filter.
    expect(screen.getByRole("combobox", { name: /statut/i })).toBeInTheDocument();
  });
});

describe("ContractList — New contract CTA gate (T-04-06)", () => {
  it("does not render the CTA when the user has no resolved scope", async () => {
    await mount();
    await screen.findByRole("table");
    expect(screen.queryByRole("link", { name: "Nouveau contrat" })).not.toBeInTheDocument();
  });

  it("renders a CTA linking to /contrats/nouveau for an agent-capable scope", async () => {
    useAuthStore.setState({ scope: scopeFromMe(ownerFixture.me) });
    await mount();
    await screen.findByRole("table");

    const cta = screen.getByRole("link", { name: "Nouveau contrat" });
    expect(cta).toHaveAttribute("href", "/contrats/nouveau");
  });
});

describe("ContractList — UI states", () => {
  it("links each row's plate to /contrats/{id}", async () => {
    await mount();
    const table = await screen.findByRole("table");
    // The closed contract's row is unique (single closed fixture on vehicleRented).
    const closed = contractFixtures.find((c) => c.status === "closed")!;
    const links = within(table).getAllByRole("link", {
      name: vehicleRented.registration_plate,
    });
    expect(links.some((l) => l.getAttribute("href") === `/contrats/${closed.id}`)).toBe(true);
  });

  it("renders skeleton rows while the composition is pending", async () => {
    server.use(
      http.get(`${API_URL}/vehicles`, async () => {
        await delay(60);
        return HttpResponse.json([vehicleAvailable, vehicleRented]);
      }),
    );
    await mount();
    expect(screen.getByTestId("contract-list-loading")).toBeInTheDocument();
    await screen.findByRole("table");
  });

  it("shows an inline error banner with a working Réessayer button on a fetch failure", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${API_URL}/vehicles`, () => new HttpResponse(null, { status: 500 })),
    );
    await mount();

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument(), {
      timeout: 5000,
    });
    expect(screen.getByText(/impossible de charger les contrats/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    // Recovery: healthy handler + Réessayer refetches the composition.
    server.use(
      http.get(`${API_URL}/vehicles`, () =>
        HttpResponse.json([vehicleAvailable, vehicleRented]),
      ),
    );
    await user.click(screen.getByRole("button", { name: /réessayer/i }));

    await screen.findByRole("table");
  }, 15000);

  it("renders the EmptyState when the composition yields zero contracts", async () => {
    server.use(http.get(`${API_URL}/vehicles`, () => HttpResponse.json([])));
    await mount();

    await waitFor(() => {
      expect(
        screen.getByText(/aucun contrat de location n'a encore été créé/i),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "Aucun contrat" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("also renders a mobile card stack mirroring the rows (both table and cards in the DOM)", async () => {
    await mount();
    await screen.findByRole("table");
    const cards = screen.getByTestId("contract-card-stack");
    expect(
      within(cards).getAllByText(vehicleAvailable.registration_plate).length,
    ).toBeGreaterThan(0);
  });
});
