/**
 * InvoiceDetail integration (BILL-02/03/04). Uses the shared MSW billing
 * handlers: the invoice detail serves the issued fixture, recording a payment
 * that clears the TTC flips the status to paid, and a credit note returns the
 * voided-mirror number.
 */
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
import { useAuthStore } from "@/shared/auth/store";
import { scopeFromMe } from "@/shared/auth/permissions";
import { ownerFixture } from "@/test/fixtures/scope";
import { invoiceIssuedFixture } from "@/test/fixtures/billing";
import { InvoiceDetail } from "./InvoiceDetail";

const INVOICE_ID = invoiceIssuedFixture.id;

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

async function renderInvoice() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rootRoute = createRootRoute();
  const invoiceRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/factures/$invoiceId",
    component: () => <InvoiceDetail invoiceId={INVOICE_ID} />,
  });
  const contractRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/contrats/$contractId",
    component: () => <div>contract</div>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([invoiceRoute, contractRoute]),
    history: createMemoryHistory({ initialEntries: [`/factures/${INVOICE_ID}`] }),
  });
  function Harness({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  await act(async () => {
    await router.load();
  });
  render(
    <Harness>
      <RouterProvider router={router} />
    </Harness>,
  );
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

describe("InvoiceDetail", () => {
  it("renders the invoice with its lines and totals", async () => {
    await renderInvoice();
    await waitFor(() =>
      expect(screen.getByText("Location véhicule — 5 jours")).toBeInTheDocument(),
    );
    expect(screen.getByRole("heading", { name: /FACT-2026-000001/ })).toBeInTheDocument();
    // Décret mention: total in words.
    expect(
      screen.getByText(/cinq mille neuf cent cinquante dinars algériens/),
    ).toBeInTheDocument();
    // Authenticated PDF download affordance (BILL-05).
    expect(screen.getByRole("button", { name: /Facture \(PDF\)/ })).toBeInTheDocument();
  });

  it("records a payment that clears the TTC and flips the status to paid (BILL-03)", async () => {
    const user = userEvent.setup();
    await renderInvoice();
    await waitFor(() => expect(screen.getByLabelText("Montant (DZD)")).toBeInTheDocument());

    await user.type(screen.getByLabelText("Montant (DZD)"), "5950");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(screen.getAllByText("Payée").length).toBeGreaterThan(0));
  });

  it("issues a credit note and confirms with its number (BILL-04)", async () => {
    const user = userEvent.setup();
    await renderInvoice();
    await waitFor(() => expect(screen.getByLabelText("Motif de l'avoir")).toBeInTheDocument());

    await user.type(screen.getByLabelText("Motif de l'avoir"), "Erreur de facturation");
    await user.click(screen.getByRole("button", { name: "Émettre l'avoir" }));

    await waitFor(() =>
      expect(screen.getByText("Avoir AV-2026-000001 émis.")).toBeInTheDocument(),
    );
  });
});
