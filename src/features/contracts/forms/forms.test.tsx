/**
 * Behavior tests for the three lifecycle forms (04-03 Task 1).
 *
 * Driven through the shared MSW handlers + a fresh QueryClient (retry: false).
 * Each form calls its 04-01 mutation and, on a 409 (stale-UI illegal
 * transition), surfaces the DISTINCT transitionErrorKey message AND refetches
 * the contract (invalidate ['contracts','detail',id]) so the parent re-gates.
 * A non-409 failure shows the generic per-action error key.
 */
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import i18n from "@/shared/i18n";
import { server } from "@/test/mocks/server";
import { reservedContract, activeContractFixture } from "@/test/fixtures/contracts";
import { ActivateForm } from "./ActivateForm";
import { CloseForm } from "./CloseForm";
import { CancelForm } from "./CancelForm";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080/v1";

let queryClient: QueryClient;

function Harness({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
});

afterEach(async () => {
  queryClient.clear();
  await i18n.changeLanguage("fr");
});

describe("ActivateForm", () => {
  it("submits mileage + fuel via the activate endpoint and calls onDone", async () => {
    const user = userEvent.setup();
    let sent: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_URL}/rental-contracts/:contractId/activate`, async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...activeContractFixture }, { status: 200 });
      }),
    );
    const onDone = vi.fn();
    render(
      <Harness>
        <ActivateForm contract={reservedContract} onDone={onDone} />
      </Harness>,
    );

    await user.clear(screen.getByLabelText(/kilométrage/i));
    await user.type(screen.getByLabelText(/kilométrage/i), "12345");
    await user.click(screen.getByRole("button", { name: /activer le départ/i }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(sent).toMatchObject({ mileage: 12345, fuel: "full" });
  });

  it("maps a 409 to the distinct notReservable message and refetches the contract", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API_URL}/rental-contracts/:contractId/activate`, () =>
        HttpResponse.json({ detail: "illegal transition" }, { status: 409 }),
      ),
    );
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const onDone = vi.fn();
    render(
      <Harness>
        <ActivateForm contract={reservedContract} onDone={onDone} />
      </Harness>,
    );

    await user.type(screen.getByLabelText(/kilométrage/i), "100");
    await user.click(screen.getByRole("button", { name: /activer le départ/i }));

    await waitFor(() =>
      expect(screen.getByText(/n'est plus réservable/i)).toBeInTheDocument(),
    );
    expect(onDone).not.toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["contracts", "detail", reservedContract.id],
    });
  });
});

describe("CloseForm", () => {
  it("rejects submission with zero invoice lines then succeeds with one, sending integer cents", async () => {
    const user = userEvent.setup();
    let sent: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_URL}/rental-contracts/:contractId/close`, async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { ...activeContractFixture, status: "closed" },
          { status: 200 },
        );
      }),
    );
    const onDone = vi.fn();
    render(
      <Harness>
        <CloseForm contract={activeContractFixture} onDone={onDone} />
      </Harness>,
    );

    // Remove the required first line -> submit should fail validation.
    await user.click(screen.getByRole("button", { name: /supprimer la ligne/i }));
    await user.type(screen.getByLabelText(/kilométrage/i), "16050");
    await user.click(screen.getByRole("button", { name: /^clôturer/i }));

    await waitFor(() =>
      expect(screen.getByText(/au moins une ligne de facture/i)).toBeInTheDocument(),
    );
    expect(sent).toBeNull();

    // Add a line back and fill it, then submit successfully.
    await user.click(screen.getByRole("button", { name: /ajouter une ligne/i }));
    await user.type(screen.getByLabelText(/description/i), "Location");
    await user.clear(screen.getByLabelText(/quantité/i));
    await user.type(screen.getByLabelText(/quantité/i), "1");
    await user.type(screen.getByLabelText(/montant/i), "35000");
    await user.click(screen.getByRole("button", { name: /^clôturer/i }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const lines = (sent as unknown as { invoice_lines: Array<Record<string, number>> })
      .invoice_lines;
    expect(lines).toHaveLength(1);
    expect(lines[0].unit_price_ht_cents).toBe(3_500_000);
    expect(Number.isInteger(lines[0].unit_price_ht_cents)).toBe(true);
  });
});

describe("CancelForm", () => {
  it("requires a reason before submitting", async () => {
    const user = userEvent.setup();
    let posted = false;
    server.use(
      http.post(`${API_URL}/rental-contracts/:contractId/cancel`, async () => {
        posted = true;
        return HttpResponse.json(
          { ...reservedContract, status: "cancelled" },
          { status: 200 },
        );
      }),
    );
    const onDone = vi.fn();
    render(
      <Harness>
        <CancelForm contract={reservedContract} onDone={onDone} />
      </Harness>,
    );

    await user.click(screen.getByRole("button", { name: /^annuler le contrat/i }));
    await waitFor(() =>
      expect(screen.getByText(/motif d'annulation est requis/i)).toBeInTheDocument(),
    );
    expect(posted).toBe(false);

    await user.type(screen.getByLabelText(/motif/i), "Client indisponible");
    await user.click(screen.getByRole("button", { name: /^annuler le contrat/i }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });
});
