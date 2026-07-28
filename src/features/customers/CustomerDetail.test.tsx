/**
 * Behavior tests for the /clients/$customerId detail screen (CUST-01/02/03,
 * D-05).
 *
 * Driven through the shared MSW handlers + a fresh QueryClient (retry: false)
 * and a minimal memory-history router that registers /clients so the
 * back-to-list <Link> resolves an href without the full app tree.
 *
 * Covers every line of the plan's behavior block: individual fields (full
 * name, identity doc type + number, license details) with NO drivers
 * section; company fields (legal_name + rc/nif/nis) WITH a drivers list from
 * GET /customers/{id}/drivers; omitempty guarding on a bare customer (never
 * renders the literal "undefined"); the not-found state on a 404; and a
 * drivers-query error that stays inside the drivers card without blanking
 * the page.
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
  customerBare,
  customerCompany,
  customerIndividualCin,
  driverHamdiA,
  driverHamdiB,
} from "@/test/fixtures/customers";
import { CustomerDetail } from "./CustomerDetail";

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

function buildHarness(customerId: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <CustomerDetail customerId={customerId} />,
  });
  const listRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/clients",
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

async function mount(customerId: string) {
  const { router, Harness } = buildHarness(customerId);
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

describe("CustomerDetail", () => {
  it("renders individual fields (full name, identity doc type + number, license details) with NO drivers section", async () => {
    await mount(customerIndividualCin.id);

    expect(
      await screen.findByRole("heading", { name: customerIndividualCin.full_name }),
    ).toBeInTheDocument();

    expect(screen.getByText("CIN")).toBeInTheDocument();
    expect(
      screen.getByText(customerIndividualCin.identity_doc_number!),
    ).toBeInTheDocument();
    expect(
      screen.getByText(customerIndividualCin.license_number!),
    ).toBeInTheDocument();

    // No drivers section at all for an individual customer.
    expect(screen.queryByText("Conducteurs désignés")).not.toBeInTheDocument();

    // Back-to-list link.
    const back = screen.getByRole("link", { name: /retour aux clients/i });
    expect(back).toHaveAttribute("href", "/clients");
  });

  it("renders company fields (legal_name + rc/nif/nis) and its designated drivers", async () => {
    await mount(customerCompany.id);

    expect(
      await screen.findByRole("heading", { name: customerCompany.legal_name }),
    ).toBeInTheDocument();

    expect(screen.getByText(customerCompany.rc!)).toBeInTheDocument();
    expect(screen.getByText(customerCompany.nif!)).toBeInTheDocument();
    expect(screen.getByText(customerCompany.nis!)).toBeInTheDocument();

    // Designated drivers list, from GET /customers/{id}/drivers.
    expect(await screen.findByText("Conducteurs désignés")).toBeInTheDocument();
    expect(screen.getByText(driverHamdiA.full_name)).toBeInTheDocument();
    expect(screen.getByText(driverHamdiA.license_number)).toBeInTheDocument();
    expect(screen.getByText(driverHamdiB.full_name)).toBeInTheDocument();
    expect(screen.getByText(driverHamdiB.license_number)).toBeInTheDocument();
  });

  it("omits absent optional fields on a bare customer — never renders the string 'undefined'", async () => {
    const { container } = await mount(customerBare.id);

    // Bare customer has no full_name — heading renders empty, not "undefined".
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /retour aux clients/i })).toBeInTheDocument();
    });

    expect(screen.queryByText("CIN")).not.toBeInTheDocument();
    expect(screen.queryByText("Passeport")).not.toBeInTheDocument();
    expect(screen.queryByText("Numéro de permis")).not.toBeInTheDocument();
    expect(screen.queryByText("Conducteurs désignés")).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/undefined/);
  });

  it("renders the not-found state with a working back link for an unknown customer id", async () => {
    await mount("00000000-0000-4000-8000-000000000000");

    expect(await screen.findByText("Client introuvable")).toBeInTheDocument();
    expect(
      screen.getByText(/n'existe pas ou n'est plus accessible/i),
    ).toBeInTheDocument();

    const back = screen.getByRole("link", { name: /retour aux clients/i });
    expect(back).toHaveAttribute("href", "/clients");
  });

  it("renders skeletons while the customer query is pending", async () => {
    server.use(
      http.get(`${API_URL}/customers/:customerId`, async () => {
        await delay(60);
        return HttpResponse.json(customerIndividualCin);
      }),
    );
    await mount(customerIndividualCin.id);
    expect(screen.getByTestId("customer-detail-loading")).toBeInTheDocument();
    await screen.findByRole("heading", { name: customerIndividualCin.full_name });
  });

  it("shows the customer load-error banner with a working retry on a 500", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(
        `${API_URL}/customers/:customerId`,
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    await mount(customerIndividualCin.id);

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument(), {
      timeout: 5000,
    });
    expect(screen.getByText(/impossible de charger les clients/i)).toBeInTheDocument();

    server.use(
      http.get(`${API_URL}/customers/:customerId`, () =>
        HttpResponse.json(customerIndividualCin),
      ),
    );
    await user.click(screen.getByRole("button", { name: /réessayer/i }));

    await screen.findByRole("heading", { name: customerIndividualCin.full_name });
  }, 15000);

  it("shows the drivers load-error inline in the drivers card WITHOUT blanking the page, and the customer fields above still render", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(
        `${API_URL}/customers/:customerId/drivers`,
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    await mount(customerCompany.id);

    // Customer fields above the drivers card still render (page not blanked).
    await screen.findByRole("heading", { name: customerCompany.legal_name });
    expect(screen.getByText(customerCompany.rc!)).toBeInTheDocument();

    // Drivers card shows its inline error + retry.
    expect(
      await screen.findByText(/impossible de charger les conducteurs désignés/i),
    ).toBeInTheDocument();

    server.use(
      http.get(`${API_URL}/customers/:customerId/drivers`, () =>
        HttpResponse.json([driverHamdiA, driverHamdiB]),
      ),
    );
    await user.click(screen.getByRole("button", { name: /réessayer/i }));

    expect(await screen.findByText(driverHamdiA.full_name)).toBeInTheDocument();
  }, 15000);
});
