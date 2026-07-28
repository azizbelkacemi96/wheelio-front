/**
 * Placeholder-route tests (01-07): every nav destination renders the shared,
 * i18n-driven EmptyState — FR "Bientôt disponible" copy by default (AUTH-05
 * hard default), EN "Coming soon" after a locale switch, live (no remount).
 *
 * Renders the actual route files' registered components (Route.options
 * .component — EmptyState in every placeholder), not a hand-built stand-in,
 * so a route file drifting away from the shared empty state fails here.
 *
 * NOTE: this file is excluded from route generation via the
 * `routeFileIgnorePattern: "\\.test\\."` shared by scripts/generate-routes.mjs
 * and vite.config.ts — do not rename it without keeping that pattern in sync.
 */
import { afterEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import i18n from "@/shared/i18n";
import { Route as IndexRoute } from "./index";
import { Route as ContratsRoute } from "./contrats";
import { Route as EtatsDesLieuxRoute } from "./etats-des-lieux";
import { Route as AdminIdentiteFiscaleRoute } from "./admin/identite-fiscale";
import { Route as AdminAgencesRoute } from "./admin/agences";
import { Route as AdminFacturationRoute } from "./admin/facturation";

const FR_HEADING = "Bientôt disponible";
const FR_BODY = "Cette fonctionnalité arrive dans une prochaine mise à jour de Wheelio.";
const EN_HEADING = "Coming soon";
const EN_BODY = "This feature is coming in a future Wheelio update.";

// NOTE: /vehicules is no longer a placeholder — plan 02-02 replaced it with
// the real VehicleList screen, so it is intentionally absent here.
// NOTE: /clients is no longer a placeholder — plan 03-02 replaced it with
// the real CustomerList screen, so it is intentionally absent here.
const allPlaceholderRoutes = {
  "/": IndexRoute,
  "/contrats": ContratsRoute,
  "/etats-des-lieux": EtatsDesLieuxRoute,
  "/admin/identite-fiscale": AdminIdentiteFiscaleRoute,
  "/admin/agences": AdminAgencesRoute,
  "/admin/facturation": AdminFacturationRoute,
} as const;

function componentOf(route: { options: { component?: unknown } }) {
  const Component = route.options.component as React.ComponentType | undefined;
  expect(Component).toBeDefined();
  return Component!;
}

afterEach(async () => {
  await act(async () => {
    await i18n.changeLanguage("fr");
  });
  localStorage.clear();
});

describe("placeholder routes — shared empty state", () => {
  it("renders the FR 'Bientôt disponible' copy by default on a base placeholder route", () => {
    const EtatsDesLieux = componentOf(EtatsDesLieuxRoute);
    render(<EtatsDesLieux />);

    expect(screen.getByRole("heading", { name: FR_HEADING })).toBeInTheDocument();
    expect(screen.getByText(FR_BODY)).toBeInTheDocument();
    expect(screen.queryByText(EN_HEADING)).not.toBeInTheDocument();
  });

  it("switches to the EN 'Coming soon' copy live on locale change, and back to FR", async () => {
    const EtatsDesLieux = componentOf(EtatsDesLieuxRoute);
    render(<EtatsDesLieux />);
    expect(screen.getByRole("heading", { name: FR_HEADING })).toBeInTheDocument();

    await act(async () => {
      await i18n.changeLanguage("en");
    });
    expect(screen.getByRole("heading", { name: EN_HEADING })).toBeInTheDocument();
    expect(screen.getByText(EN_BODY)).toBeInTheDocument();
    expect(screen.queryByText(FR_HEADING)).not.toBeInTheDocument();

    await act(async () => {
      await i18n.changeLanguage("fr");
    });
    expect(screen.getByRole("heading", { name: FR_HEADING })).toBeInTheDocument();
  });

  it("every base + admin placeholder route registers the shared empty state as its component", () => {
    for (const [path, route] of Object.entries(allPlaceholderRoutes)) {
      const Component = componentOf(route);
      const { unmount } = render(<Component />);

      expect(
        screen.getByRole("heading", { name: FR_HEADING }),
        `route ${path} should render the shared FR empty-state heading`,
      ).toBeInTheDocument();
      expect(screen.getByText(FR_BODY)).toBeInTheDocument();

      unmount();
    }
  });
});
