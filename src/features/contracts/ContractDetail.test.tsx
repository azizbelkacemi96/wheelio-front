/**
 * Behavior tests for the /contrats/$contractId detail screen (04-03 Task 2).
 *
 * Driven through the shared MSW handlers + a fresh QueryClient (retry: false)
 * and a memory-history router registering /contrats so the back <Link>
 * resolves. Button visibility is asserted against BOTH the domain transition
 * matrix AND the agency gate (canOperate on the VEHICLE'S agency_id): a scope
 * with no operable membership hides every action even on a reserved contract.
 * The card must resolve plate + customer name from the separate vehicle/
 * customer fetches (never the raw UUIDs), and a 404 renders the generic
 * not-found state.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
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
import { useAuthStore } from "@/shared/auth/store";
import { scopeFromMe } from "@/shared/auth/permissions";
import type { Scope } from "@/shared/auth/permissions";
import { ownerFixture } from "@/test/fixtures/scope";
import { vehicleAvailable } from "@/test/fixtures/fleet";
import { customerIndividualCin } from "@/test/fixtures/customers";
import {
  activeContractFixture,
  cancelledContract,
  closedContract,
  reservedContract,
} from "@/test/fixtures/contracts";
import { ContractDetail } from "./ContractDetail";

const PLATE = vehicleAvailable.registration_plate;
const CUSTOMER_NAME = customerIndividualCin.full_name!;

/** A scope with no operable membership anywhere — canOperate is always false. */
const noOperateScope: Scope = {
  userId: "99999999-9999-4999-8999-999999999999",
  orgId: ownerFixture.me.organization.id,
  orgRole: "member",
  agencyRoles: {},
};

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

async function mount(contractId: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <ContractDetail contractId={contractId} />,
  });
  const listRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/contrats",
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
});

afterEach(async () => {
  resetAuthStore();
  await act(async () => {
    await i18n.changeLanguage("fr");
  });
});

describe("ContractDetail — resolved card", () => {
  it("resolves the plate + customer name from the separate fetches (never raw UUIDs)", async () => {
    useAuthStore.setState({ scope: scopeFromMe(ownerFixture.me) });
    await mount(reservedContract.id);

    expect(await screen.findByText(new RegExp(PLATE))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(CUSTOMER_NAME))).toBeInTheDocument();
    // The raw vehicle/customer UUIDs must never reach the DOM.
    expect(screen.queryByText(reservedContract.vehicle_id)).not.toBeInTheDocument();
    expect(screen.queryByText(reservedContract.customer_id)).not.toBeInTheDocument();
  });
});

describe("ContractDetail — status-gated actions (owner may operate)", () => {
  it("a reserved contract shows Activate + Cancel and NOT Close", async () => {
    useAuthStore.setState({ scope: scopeFromMe(ownerFixture.me) });
    await mount(reservedContract.id);

    expect(
      await screen.findByRole("button", { name: /^activer le départ$/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^annuler$/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^clôturer$/i }),
    ).not.toBeInTheDocument();
  });

  it("an active contract shows Close + Cancel and NOT Activate", async () => {
    useAuthStore.setState({ scope: scopeFromMe(ownerFixture.me) });
    await mount(activeContractFixture.id);

    expect(
      await screen.findByRole("button", { name: /^clôturer$/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^annuler$/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^activer le départ$/i }),
    ).not.toBeInTheDocument();
  });

  it("a closed contract shows no action buttons", async () => {
    useAuthStore.setState({ scope: scopeFromMe(ownerFixture.me) });
    await mount(closedContract.id);

    // Wait for the card (status badge resolves) before asserting the actions absence.
    await screen.findAllByText("Clôturé");
    expect(
      screen.queryByRole("button", { name: /^activer le départ$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^clôturer$/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^annuler$/i })).not.toBeInTheDocument();
  });

  it("a cancelled contract shows no action buttons", async () => {
    useAuthStore.setState({ scope: scopeFromMe(ownerFixture.me) });
    await mount(cancelledContract.id);

    await screen.findAllByText("Annulé");
    expect(
      screen.queryByRole("button", { name: /^activer le départ$/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^annuler$/i })).not.toBeInTheDocument();
  });
});

describe("ContractDetail — agency gate (T-04-01)", () => {
  it("hides all action buttons for a scope without canOperate on the vehicle's agency, even for a reserved contract", async () => {
    useAuthStore.setState({ scope: noOperateScope });
    await mount(reservedContract.id);

    // The card still renders (read is allowed by the backend, gate is UX).
    expect(await screen.findByText(new RegExp(PLATE))).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^activer le départ$/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^annuler$/i })).not.toBeInTheDocument();
  });
});

describe("ContractDetail — not found (T-04-07)", () => {
  it("renders the generic not-found state for an unknown contract id", async () => {
    useAuthStore.setState({ scope: scopeFromMe(ownerFixture.me) });
    await mount("00000000-0000-4000-8000-000000000000");

    expect(await screen.findByText(/contrat introuvable/i)).toBeInTheDocument();
  });
});
