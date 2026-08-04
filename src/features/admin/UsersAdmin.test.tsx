/**
 * UsersAdmin (Phase 9) — org-admin gate, user list, and create-user flow.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import i18n from "@/shared/i18n";
import { useAuthStore } from "@/shared/auth/store";
import { scopeFromMe } from "@/shared/auth/permissions";
import type { Scope } from "@/shared/auth/permissions";
import { ownerFixture } from "@/test/fixtures/scope";
import { UsersAdmin } from "./UsersAdmin";

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

function renderUsers() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Harness({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  render(
    <Harness>
      <UsersAdmin />
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

describe("UsersAdmin", () => {
  it("denies a non-admin member", () => {
    const memberScope: Scope = {
      userId: "u1",
      orgId: ownerFixture.me.organization.id,
      orgRole: "member",
      agencyRoles: {},
    };
    useAuthStore.setState({ scope: memberScope });
    renderUsers();
    expect(screen.getByRole("heading", { name: "Accès non autorisé" })).toBeInTheDocument();
  });

  it("lists the org users for an admin", async () => {
    useAuthStore.setState({ scope: scopeFromMe(ownerFixture.me) });
    renderUsers();
    await waitFor(() => expect(screen.getByText("Nadia Agent")).toBeInTheDocument());
    expect(screen.getByText("nadia@wheelio.dz")).toBeInTheDocument();
  });

  it("creates a new user and confirms", async () => {
    const user = userEvent.setup();
    useAuthStore.setState({ scope: scopeFromMe(ownerFixture.me) });
    renderUsers();

    await user.type(screen.getByLabelText("Prénom"), "Karim");
    await user.type(screen.getByLabelText("Nom"), "Bensalem");
    await user.type(screen.getByLabelText("Email"), "karim@wheelio.dz");
    await user.type(screen.getByLabelText("Mot de passe"), "motdepasse8");
    await user.click(screen.getByRole("button", { name: "Créer l'utilisateur" }));

    await waitFor(() => expect(screen.getByText("Utilisateur créé.")).toBeInTheDocument());
  });
});
