/**
 * InspectionScreen integration (INSP-01/02/03 + D-09 gate). Uses the shared
 * MSW handlers for create/damage/validate; the photo pipeline deps are injected
 * as instant fakes (photoOptions) so a captured photo reaches `attached`
 * without a real canvas/network, unblocking the Validate gate.
 */
import { http, HttpResponse } from "msw";
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
import { scopeFromMe } from "@/shared/auth/permissions";
import type { Scope } from "@/shared/auth/permissions";
import { ownerFixture } from "@/test/fixtures/scope";
import { activeContractFixture } from "@/test/fixtures/fleet";
import { InspectionScreen } from "./InspectionScreen";
import type { UseDamagePhotosOptions } from "./upload/useDamagePhotos";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080/v1";
const CONTRACT_ID = activeContractFixture.id;

const instantPhotoOptions: UseDamagePhotosOptions = {
  compress: async () => new Blob(["x"], { type: "image/jpeg" }),
  upload: async () => ({ id: "doc-1" }),
  attach: async () => {},
  backoff: () => 0,
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

function mount() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rootRoute = createRootRoute();
  const inspRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/insp",
    component: () => (
      <InspectionScreen contractId={CONTRACT_ID} photoOptions={instantPhotoOptions} />
    ),
  });
  const contractRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/contrats/$contractId",
    component: () => <div>contract detail</div>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([inspRoute, contractRoute]),
    history: createMemoryHistory({ initialEntries: ["/insp"] }),
  });
  function Harness({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { router, Harness };
}

async function renderScreen() {
  const { router, Harness } = mount();
  await act(async () => {
    await router.load();
  });
  render(
    <Harness>
      <RouterProvider router={router} />
    </Harness>,
  );
}

/** Open a Radix Select by its trigger aria-label and click the named option. */
async function selectOption(triggerLabel: string, optionName: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox", { name: triggerLabel }));
  await user.click(await screen.findByRole("option", { name: optionName }));
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

describe("InspectionScreen", () => {
  it("runs the full flow: create → record damage → capture photo → validate", async () => {
    const user = userEvent.setup();
    await renderScreen();

    // Create step
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Démarrer l'état des lieux" })).toBeInTheDocument(),
    );
    await user.type(screen.getByLabelText("Kilométrage"), "45230");
    await selectOption("Niveau de carburant", "Plein");
    await user.click(screen.getByRole("button", { name: "Démarrer l'état des lieux" }));

    // Capture step
    await waitFor(() =>
      expect(screen.getByText("Aucun dommage constaté pour l'instant.")).toBeInTheDocument(),
    );

    // Record one damage
    await selectOption("Zone", "Porte avant gauche");
    await selectOption("Type de dommage", "Rayure");
    await selectOption("Gravité", "Léger");
    await user.click(screen.getByRole("button", { name: "Ajouter le dommage" }));

    // The damage now shows with its photo capture (unique "Photos" section);
    // Validate is blocked until a photo is attached.
    await waitFor(() => expect(screen.getByText("Photos")).toBeInTheDocument());
    const validateBtn = screen.getByRole("button", { name: "Valider l'état des lieux" });
    expect(validateBtn).toBeDisabled();

    // Capture a photo — injected fakes drive it straight to attached.
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, new File(["img"], "photo.jpg", { type: "image/jpeg" }));
    await waitFor(() => expect(screen.getByText("Enregistrée")).toBeInTheDocument());

    // Now validatable.
    await waitFor(() => expect(validateBtn).toBeEnabled());
    await user.click(validateBtn);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "État des lieux validé" })).toBeInTheDocument(),
    );
  });

  it("blocks a user who cannot operate on the vehicle's agency (D-09)", async () => {
    // A member with agent role only in some OTHER agency — not vehicleRented's.
    const otherAgencyScope: Scope = {
      userId: "u-x",
      orgId: ownerFixture.me.organization.id,
      orgRole: "member",
      agencyRoles: { "ffffffff-ffff-4fff-8fff-ffffffffffff": "agent" },
    };
    useAuthStore.setState({ scope: otherAgencyScope });

    await renderScreen();

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Accès non autorisé" })).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: "Démarrer l'état des lieux" }),
    ).not.toBeInTheDocument();
  });

  it("surfaces the 409 when a return is requested with no validated departure", async () => {
    server.use(
      http.post(`${API_URL}/rental-contracts/:contractId/inspections`, () =>
        HttpResponse.json(
          { title: "Conflict", status: 409, detail: "a validated departure inspection is required" },
          { status: 409, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );
    const user = userEvent.setup();
    await renderScreen();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Démarrer l'état des lieux" })).toBeInTheDocument(),
    );
    await selectOption("Type d'état des lieux", "État de retour");
    await user.type(screen.getByLabelText("Kilométrage"), "20000");
    await selectOption("Niveau de carburant", "Plein");
    await user.click(screen.getByRole("button", { name: "Démarrer l'état des lieux" }));

    await waitFor(() =>
      expect(
        screen.getByText(
          "Un état des lieux de sortie validé est requis avant un état de retour.",
        ),
      ).toBeInTheDocument(),
    );
  });
});
