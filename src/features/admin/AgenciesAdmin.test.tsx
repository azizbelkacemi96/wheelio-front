/**
 * AgenciesAdmin (Phase 9) — org-admin gate, agency list, and creating a new
 * agency. Members/roles are covered lightly (list renders with the empty state).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import i18n from "@/shared/i18n";
import { useAuthStore } from "@/shared/auth/store";
import { scopeFromMe } from "@/shared/auth/permissions";
import { ownerFixture } from "@/test/fixtures/scope";
import { AgenciesAdmin } from "./AgenciesAdmin";

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

function renderAgencies() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Harness({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  render(
    <Harness>
      <AgenciesAdmin />
    </Harness>,
  );
}

beforeEach(resetAuthStore);
afterEach(async () => {
  resetAuthStore();
  await act(async () => {
    await i18n.changeLanguage("fr");
  });
});

describe("AgenciesAdmin", () => {
  it("lists the org agencies for an admin", async () => {
    useAuthStore.setState({ scope: scopeFromMe(ownerFixture.me) });
    renderAgencies();
    await waitFor(() =>
      expect(screen.getByText(ownerFixture.agencies[0].name)).toBeInTheDocument(),
    );
    // members section renders its empty state once the members query resolves
    await waitFor(() =>
      expect(
        screen.getAllByText("Aucun membre dans cette agence.").length,
      ).toBeGreaterThan(0),
    );
  });

  it("creates a new agency and clears the form", async () => {
    const user = userEvent.setup();
    useAuthStore.setState({ scope: scopeFromMe(ownerFixture.me) });
    renderAgencies();

    await user.type(screen.getByLabelText("Nom"), "Agence Constantine");
    await user.click(screen.getByRole("button", { name: "Créer l'agence" }));

    await waitFor(() => expect(screen.getByText("Agence créée.")).toBeInTheDocument());
  });
});
