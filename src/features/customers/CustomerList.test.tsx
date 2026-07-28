/**
 * Behavior tests for the /clients list screen (CUST-03).
 *
 * Driven through the shared MSW handlers + a fresh QueryClient (retry:
 * false) and a minimal memory-history router that registers
 * /clients/$customerId so the per-row display-name <Link> resolves an
 * href without the full app tree.
 *
 * UNLIKE fleet's client-side text filter, search here is SERVER-side
 * (CUST-03, D-04): typing a term must issue a NEW ?q= request (debounced
 * ~300ms) and re-render with only the server-filtered fixtures — the
 * network round-trip itself is asserted, never a client array filter.
 *
 * Covers the plan's behavior block: full-fixture rendering with display
 * name + type badge; the server-side ?q= search round-trip; the D-09-style
 * state quartet (skeleton / error+retry / empty / no-results); and the
 * display-name -> detail link target.
 */
import { delay, http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
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
import {
  customerCompany,
  customerFixtures,
  customerIndividualCin,
  customerIndividualPassport,
} from "@/test/fixtures/customers";
import { CustomerList } from "./CustomerList";

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

function renderList() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: CustomerList,
  });
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/clients/$customerId",
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

afterEach(async () => {
  resetAuthStore();
  await act(async () => {
    await i18n.changeLanguage("fr");
  });
});

describe("CustomerList — New customer CTA (CR-01)", () => {
  it("does not render the New customer CTA when the user has no resolved scope", async () => {
    await mount();
    await screen.findByRole("table");

    expect(screen.queryByRole("link", { name: "Nouveau client" })).not.toBeInTheDocument();
  });

  it("renders a New customer CTA linking to /clients/nouveau for an authorized (agent+) scope", async () => {
    useAuthStore.setState({ scope: scopeFromMe(ownerFixture.me) });
    await mount();
    await screen.findByRole("table");

    const cta = screen.getByRole("link", { name: "Nouveau client" });
    expect(cta).toHaveAttribute("href", "/clients/nouveau");
  });
});

describe("CustomerList — search stays mounted mid-fetch (CR-02)", () => {
  it("keeps the search input mounted (not swapped for a skeleton) while a subsequent search request is in flight", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${API_URL}/customers`, async ({ request }) => {
        const q = new URL(request.url).searchParams.get("q");
        if (q) await delay(200);
        return HttpResponse.json(customerFixtures);
      }),
    );
    await mount();
    await screen.findByRole("table");

    await user.type(screen.getByRole("searchbox"), "hamdi");

    // Past the 300ms debounce but before the slower (200ms) server
    // response resolves, the query key has changed and a new request is
    // in flight. Under the CR-02 bug, `showControls` gates on
    // `query.isSuccess`, which flips to `false` the instant a
    // never-before-fetched key starts loading — unmounting the very Input
    // holding "hamdi". With `placeholderData: keepPreviousData`
    // (queries.ts) the previous result set (and a non-pending status)
    // stays visible, so the input survives across the whole cycle.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    expect(screen.getByRole("searchbox")).toHaveValue("hamdi");
    expect(screen.queryByTestId("customer-list-loading")).not.toBeInTheDocument();
  }, 10000);
});

describe("CustomerList", () => {
  it("renders every fixture customer with its display name and a type badge", async () => {
    await mount();
    const table = await screen.findByRole("table");

    // one data row per fixture (+1 header row)
    expect(within(table).getAllByRole("row")).toHaveLength(customerFixtures.length + 1);

    // individual -> full_name, company -> legal_name
    expect(within(table).getByText(customerIndividualCin.full_name!)).toBeInTheDocument();
    expect(within(table).getByText(customerIndividualPassport.full_name!)).toBeInTheDocument();
    expect(within(table).getByText(customerCompany.legal_name!)).toBeInTheDocument();

    // type badges (translated, both enum values present)
    expect(within(table).getAllByText("Particulier").length).toBeGreaterThan(0);
    expect(within(table).getByText("Entreprise")).toBeInTheDocument();
  });

  it("typing a search term issues a NEW request carrying ?q= and re-renders with only the server-filtered fixtures", async () => {
    const user = userEvent.setup();
    const urls: string[] = [];
    server.use(
      http.get(`${API_URL}/customers`, ({ request }) => {
        urls.push(request.url);
        const q = new URL(request.url).searchParams.get("q")?.toLowerCase() ?? "";
        const data = q
          ? customerFixtures.filter((c) =>
              (c.full_name ?? c.legal_name ?? "").toLowerCase().includes(q),
            )
          : customerFixtures;
        return HttpResponse.json(data);
      }),
    );
    await mount();
    await screen.findByRole("table");
    const initialRequestCount = urls.length;

    await user.type(screen.getByRole("searchbox"), "hamdi");

    await waitFor(
      () => {
        expect(urls.length).toBeGreaterThan(initialRequestCount);
      },
      { timeout: 2000 },
    );
    expect(urls.some((u) => new URL(u).searchParams.get("q") === "hamdi")).toBe(true);

    await waitFor(() => {
      const table = screen.getByRole("table");
      expect(within(table).getByText(customerCompany.legal_name!)).toBeInTheDocument();
      expect(
        within(table).queryByText(customerIndividualCin.full_name!),
      ).not.toBeInTheDocument();
    });
  });

  it("renders skeleton rows while the query is pending", async () => {
    server.use(
      http.get(`${API_URL}/customers`, async () => {
        await delay(60);
        return HttpResponse.json(customerFixtures);
      }),
    );
    await mount();
    expect(screen.getByTestId("customer-list-loading")).toBeInTheDocument();
    await screen.findByRole("table");
  });

  it("shows an inline error banner with a working Réessayer button on a fetch failure", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${API_URL}/customers`, () => new HttpResponse(null, { status: 500 })),
    );
    await mount();

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument(), {
      timeout: 5000,
    });
    expect(screen.getByText(/impossible de charger les clients/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    server.use(http.get(`${API_URL}/customers`, () => HttpResponse.json(customerFixtures)));
    await user.click(screen.getByRole("button", { name: /réessayer/i }));

    const table = await screen.findByRole("table");
    expect(within(table).getByText(customerCompany.legal_name!)).toBeInTheDocument();
  }, 15000);

  it("renders the EmptyState when the API returns zero customers", async () => {
    server.use(http.get(`${API_URL}/customers`, () => HttpResponse.json([])));
    await mount();

    await waitFor(() => {
      expect(screen.getByText(/aucun client n'est encore enregistré/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "Aucun client" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows the distinct noResults copy (not the EmptyState) when a search matches nothing", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${API_URL}/customers`, ({ request }) => {
        const q = new URL(request.url).searchParams.get("q");
        return HttpResponse.json(q ? [] : customerFixtures);
      }),
    );
    await mount();
    await screen.findByRole("table");

    await user.type(screen.getByRole("searchbox"), "zzz-no-such-customer");

    await waitFor(
      () => {
        expect(screen.getByText(/aucun client ne correspond à votre recherche/i)).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    // NOT the true-empty EmptyState body
    expect(screen.queryByText(/aucun client n'est encore enregistré/i)).not.toBeInTheDocument();
  });

  it("links each row's display name to /clients/{id}", async () => {
    await mount();
    const table = await screen.findByRole("table");
    const link = within(table).getByRole("link", {
      name: customerCompany.legal_name!,
    });
    expect(link).toHaveAttribute("href", `/clients/${customerCompany.id}`);
  });

  it("also renders a mobile card stack mirroring the rows (both table and cards in the DOM)", async () => {
    await mount();
    await screen.findByRole("table");
    const cards = screen.getByTestId("customer-card-stack");
    expect(within(cards).getByText(customerIndividualCin.full_name!)).toBeInTheDocument();
    expect(within(cards).getByText(customerCompany.legal_name!)).toBeInTheDocument();
  });

  it("shows the customer count via the plural key", async () => {
    await mount();
    await screen.findByRole("table");

    expect(screen.getByText(`${customerFixtures.length} clients`)).toBeInTheDocument();
  });
});
