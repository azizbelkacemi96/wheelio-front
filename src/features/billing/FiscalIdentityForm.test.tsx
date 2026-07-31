/**
 * FiscalIdentityForm (BILL-01). Org-admin only; the mandatory décret fields are
 * enforced client-side (the completeness gate) before the PATCH.
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
import { FiscalIdentityForm } from "./FiscalIdentityForm";

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

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Harness({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  render(
    <Harness>
      <FiscalIdentityForm />
    </Harness>,
  );
}

afterEach(async () => {
  resetAuthStore();
  await act(async () => {
    await i18n.changeLanguage("fr");
  });
});

describe("FiscalIdentityForm", () => {
  beforeEach(() => resetAuthStore());

  it("denies a non-admin", () => {
    const memberScope: Scope = {
      userId: "u1",
      orgId: ownerFixture.me.organization.id,
      orgRole: "member",
      agencyRoles: {},
    };
    useAuthStore.setState({ scope: memberScope });
    renderForm();
    expect(screen.getByRole("heading", { name: "Accès non autorisé" })).toBeInTheDocument();
  });

  it("blocks submit until the mandatory décret fields are filled, then saves", async () => {
    const user = userEvent.setup();
    useAuthStore.setState({ scope: scopeFromMe(ownerFixture.me) }); // owner = org admin
    renderForm();

    // Empty submit surfaces the required-field errors (completeness gate).
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() =>
      expect(screen.getByText("La forme juridique est requise.")).toBeInTheDocument(),
    );

    await user.type(screen.getByLabelText(/Forme juridique/), "SARL");
    await user.type(screen.getByLabelText(/^NIF/), "000016001234567");
    await user.type(screen.getByLabelText(/^NIS/), "000016009876543");
    await user.type(screen.getByLabelText(/Adresse/), "12 rue Didouche Mourad");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() =>
      expect(screen.getByText("Identité fiscale enregistrée.")).toBeInTheDocument(),
    );
  });
});
