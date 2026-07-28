/**
 * Behavior tests for CustomerCreateForm (03-03-PLAN.md Task 3 behavior
 * block) — driven through MSW + a fresh QueryClient + a minimal
 * memory-history router that registers /clients/$customerId so the
 * post-create navigation target resolves without the full app tree.
 *
 * Covers: the type-toggle radiogroup default (individual) and its swap to
 * company; individual and company happy paths (create-then-attach,
 * navigation); cin-required client-side validation blocking submit; the
 * drivers sub-form add/remove (field.id keys, zero/one/many); and the
 * driver partial-failure UI + retry that does NOT re-POST /customers.
 */
import { http, HttpResponse } from "msw";
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
import type { CreateDriverBody, CustomerResponse } from "@/types/customer";
import { CustomerCreateForm } from "./CustomerCreateForm";

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

function buildHarness() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: CustomerCreateForm,
  });
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/clients/$customerId",
    component: function DetailStub() {
      const { customerId } = detailRoute.useParams();
      return <div>detail:{customerId}</div>;
    },
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
  const { router, Harness } = buildHarness();
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
  useAuthStore.setState({ scope: scopeFromMe(ownerFixture.me) });
});

afterEach(async () => {
  resetAuthStore();
  await act(async () => {
    await i18n.changeLanguage("fr");
  });
});

function mockCreateCustomer(idPrefix: string) {
  let n = 0;
  server.use(
    http.post(`${API_URL}/customers`, async ({ request }) => {
      n += 1;
      const body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json<CustomerResponse>(
        { ...body, id: `${idPrefix}-${n}`, created_at: "now", updated_at: "now" } as CustomerResponse,
        { status: 201 },
      );
    }),
  );
}

describe("CustomerCreateForm — type toggle", () => {
  it("defaults to the individual branch (full_name + identity doc + license), hiding rc/nif/nis", async () => {
    await mount();

    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /particulier/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /entreprise/i })).not.toBeChecked();

    expect(screen.getByLabelText(/nom complet/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/type de pièce d'identité/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/numéro de pièce/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/numéro de permis/i)).toBeInTheDocument();

    expect(screen.queryByLabelText(/raison sociale/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/registre de commerce/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^nif$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^nis$/i)).not.toBeInTheDocument();
  });

  it("toggling to company swaps to legal_name + rc/nif/nis + drivers sub-form, hiding identity-doc fields", async () => {
    const user = userEvent.setup();
    await mount();

    await user.click(screen.getByRole("radio", { name: /entreprise/i }));

    expect(screen.getByLabelText(/raison sociale/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/registre de commerce/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^nif$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^nis$/i)).toBeInTheDocument();
    expect(screen.getByText(/conducteurs désignés/i)).toBeInTheDocument();

    expect(screen.queryByLabelText(/nom complet/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/type de pièce d'identité/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/numéro de pièce/i)).not.toBeInTheDocument();
  });

  it("toggling back to individual clears a blank/invalid drivers row added while on company, so submit is not silently blocked (CR-03)", async () => {
    const user = userEvent.setup();
    mockCreateCustomer("new-after-toggle");
    await mount();

    await user.click(screen.getByRole("radio", { name: /entreprise/i }));
    await user.click(screen.getByRole("button", { name: /ajouter un conducteur/i }));
    expect(screen.getByTestId("driver-row-0")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /particulier/i }));
    // The (still-blank, still-invalid) drivers row must be gone, not merely
    // hidden — otherwise it re-fails validation on the individual branch
    // with no rendered error anywhere (the bug this test guards against).
    expect(screen.queryByTestId("driver-row-0")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/nom complet/i), "Yacine Belkacem");
    await user.type(screen.getByLabelText(/numéro de pièce/i), "123456789012");
    await user.click(screen.getByRole("button", { name: /créer le client/i }));

    await waitFor(() => {
      expect(screen.getByText(/^detail:new-after-toggle-1$/)).toBeInTheDocument();
    });
  });
});

describe("CustomerCreateForm — individual", () => {
  it("cin-required: empty number shows the cinRequired message and blocks submit (no request)", async () => {
    const user = userEvent.setup();
    let customerPosts = 0;
    server.use(
      http.post(`${API_URL}/customers`, () => {
        customerPosts += 1;
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    await mount();

    await user.type(screen.getByLabelText(/nom complet/i), "Yacine Belkacem");
    await user.click(screen.getByRole("button", { name: /créer le client/i }));

    expect(await screen.findByText(/le numéro de cin est requis/i)).toBeInTheDocument();
    expect(customerPosts).toBe(0);
  });

  it("happy path: fill full_name + cin + a valid number, submit, POST /customers, navigate to /clients/{id}", async () => {
    const user = userEvent.setup();
    mockCreateCustomer("new-individual");
    await mount();

    await user.type(screen.getByLabelText(/nom complet/i), "Yacine Belkacem");
    await user.type(screen.getByLabelText(/numéro de pièce/i), "123456789012");
    await user.click(screen.getByRole("button", { name: /créer le client/i }));

    await waitFor(() => {
      expect(screen.getByText(/^detail:new-individual-1$/)).toBeInTheDocument();
    });
  });
});

describe("CustomerCreateForm — company + drivers", () => {
  it("happy path with 2 drivers: POST /customers then 2 driver POSTs, navigate", async () => {
    const user = userEvent.setup();
    const seenNames: string[] = [];
    mockCreateCustomer("new-company");
    server.use(
      http.post(`${API_URL}/customers/:customerId/drivers`, async ({ request }) => {
        const body = (await request.json()) as CreateDriverBody;
        seenNames.push(body.full_name);
        return HttpResponse.json({ ...body, id: `d-${seenNames.length}` }, { status: 201 });
      }),
    );
    await mount();

    await user.click(screen.getByRole("radio", { name: /entreprise/i }));
    await user.type(screen.getByLabelText(/raison sociale/i), "SARL Transport Hamdi");
    await user.type(screen.getByLabelText(/registre de commerce/i), "16/00-1234567 B 21");

    await user.click(screen.getByRole("button", { name: /ajouter un conducteur/i }));
    await user.click(screen.getByRole("button", { name: /ajouter un conducteur/i }));

    const row0 = within(screen.getByTestId("driver-row-0"));
    await user.type(row0.getByLabelText(/nom complet/i), "Karim Hamdi");
    await user.type(row0.getByLabelText(/numéro de permis/i), "AL-2018-009911");

    const row1 = within(screen.getByTestId("driver-row-1"));
    await user.type(row1.getByLabelText(/nom complet/i), "Nadia Hamdi");
    await user.type(row1.getByLabelText(/numéro de permis/i), "AL-2020-002233");

    await user.click(screen.getByRole("button", { name: /créer le client/i }));

    await waitFor(() => {
      expect(screen.getByText(/^detail:new-company-1$/)).toBeInTheDocument();
    });
    expect(seenNames).toEqual(["Karim Hamdi", "Nadia Hamdi"]);
  });

  it("drivers add/remove: remove the middle row without corrupting state; zero-driver company creates fine", async () => {
    const user = userEvent.setup();
    await mount();

    await user.click(screen.getByRole("radio", { name: /entreprise/i }));

    await user.click(screen.getByRole("button", { name: /ajouter un conducteur/i }));
    await user.click(screen.getByRole("button", { name: /ajouter un conducteur/i }));
    await user.click(screen.getByRole("button", { name: /ajouter un conducteur/i }));

    await user.type(within(screen.getByTestId("driver-row-0")).getByLabelText(/nom complet/i), "A");
    await user.type(within(screen.getByTestId("driver-row-1")).getByLabelText(/nom complet/i), "B");
    await user.type(within(screen.getByTestId("driver-row-2")).getByLabelText(/nom complet/i), "C");

    // Remove the middle row (index 1) via its own remove button.
    const middleRemove = within(screen.getByTestId("driver-row-1")).getByRole("button", {
      name: /retirer/i,
    });
    await user.click(middleRemove);

    expect(screen.getAllByTestId(/driver-row-/)).toHaveLength(2);
    expect(
      within(screen.getByTestId("driver-row-0")).getByLabelText(/nom complet/i),
    ).toHaveValue("A");
    expect(
      within(screen.getByTestId("driver-row-1")).getByLabelText(/nom complet/i),
    ).toHaveValue("C");
  });

  it("company with zero drivers creates without attempting a driver POST", async () => {
    const user = userEvent.setup();
    let driverPosts = 0;
    mockCreateCustomer("new-bare-company");
    server.use(
      http.post(`${API_URL}/customers/:customerId/drivers`, () => {
        driverPosts += 1;
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    await mount();

    await user.click(screen.getByRole("radio", { name: /entreprise/i }));
    await user.type(screen.getByLabelText(/raison sociale/i), "SARL Sans Conducteur");
    await user.type(screen.getByLabelText(/registre de commerce/i), "16/00-0000000 B 00");

    await user.click(screen.getByRole("button", { name: /créer le client/i }));

    await waitFor(() => {
      expect(screen.getByText(/^detail:new-bare-company-1$/)).toBeInTheDocument();
    });
    expect(driverPosts).toBe(0);
  });

  it("partial failure: company create succeeds but the 2nd driver POST 400s — shows partialSuccess/driverFailed naming the row, keeps the form usable, retry does NOT re-POST /customers", async () => {
    const user = userEvent.setup();
    let customerPosts = 0;
    let driverCallCount = 0;
    server.use(
      http.post(`${API_URL}/customers`, async ({ request }) => {
        customerPosts += 1;
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json<CustomerResponse>(
          { ...body, id: "existing-company-1", created_at: "now", updated_at: "now" } as CustomerResponse,
          { status: 201 },
        );
      }),
      http.post(`${API_URL}/customers/:customerId/drivers`, async ({ request }) => {
        driverCallCount += 1;
        if (driverCallCount === 2) {
          return HttpResponse.json({ message: "invalid driver" }, { status: 400 });
        }
        const body = (await request.json()) as CreateDriverBody;
        return HttpResponse.json({ ...body, id: `d-${driverCallCount}` }, { status: 201 });
      }),
    );
    await mount();

    await user.click(screen.getByRole("radio", { name: /entreprise/i }));
    await user.type(screen.getByLabelText(/raison sociale/i), "SARL Transport Hamdi");
    await user.type(screen.getByLabelText(/registre de commerce/i), "16/00-1234567 B 21");

    await user.click(screen.getByRole("button", { name: /ajouter un conducteur/i }));
    await user.click(screen.getByRole("button", { name: /ajouter un conducteur/i }));

    const row0 = within(screen.getByTestId("driver-row-0"));
    await user.type(row0.getByLabelText(/nom complet/i), "Karim Hamdi");
    await user.type(row0.getByLabelText(/numéro de permis/i), "AL-2018-009911");

    const row1 = within(screen.getByTestId("driver-row-1"));
    await user.type(row1.getByLabelText(/nom complet/i), "Nadia Hamdi");
    await user.type(row1.getByLabelText(/numéro de permis/i), "AL-2020-002233");

    await user.click(screen.getByRole("button", { name: /créer le client/i }));

    // Customer created, second driver failed — partial-failure banner names
    // the failed row (Nadia Hamdi), the create submit button is replaced by
    // a retry action (no way to re-trigger a second POST /customers).
    expect(await screen.findByText(/client créé, mais certains conducteurs/i)).toBeInTheDocument();
    expect(screen.getByText(/nadia hamdi/i)).toBeInTheDocument();
    expect(customerPosts).toBe(1);
    expect(screen.queryByRole("button", { name: /créer le client/i })).not.toBeInTheDocument();

    // Retry the failed row against the existing customer id.
    server.use(
      http.post(`${API_URL}/customers/:customerId/drivers`, async ({ request, params }) => {
        expect(params.customerId).toBe("existing-company-1");
        const body = (await request.json()) as CreateDriverBody;
        return HttpResponse.json({ ...body, id: "d-retry" }, { status: 201 });
      }),
    );
    await user.click(screen.getByRole("button", { name: /réessayer/i }));

    await waitFor(() => {
      expect(screen.getByText(/^detail:existing-company-1$/)).toBeInTheDocument();
    });
    // Still exactly one POST /customers across the whole flow (create + retry).
    expect(customerPosts).toBe(1);
  });
});
