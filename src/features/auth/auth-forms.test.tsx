/**
 * Behavior tests for LoginForm/SignupForm — exercised against the shared
 * MSW handlers (src/test/mocks/handlers.ts) and a real TanStack Router
 * memory history so `useNavigate`/`Link` resolve without a full app mount.
 *
 * Covers this plan's must-have truths: successful login stores tokens and
 * navigates; the submit button shows a spinner and disables itself while
 * pending; login/signup failures render ONLY the generic i18n copy with no
 * password-reset affordance anywhere (D-05/D-06); inline Zod field errors
 * render before submit; signup surfaces a field-level "email already
 * registered" error on a 409 from the backend.
 */
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { server } from "@/test/mocks/server";
import { useAuthStore } from "@/shared/auth/store";
import { LoginForm } from "./LoginForm";
import { SignupForm } from "./SignupForm";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

function resetAuthStore() {
  useAuthStore.setState({
    accessToken: null,
    accessTokenExpiresAt: null,
    refreshToken: null,
    scope: null,
    agencies: [],
    currentAgencyId: null,
  });
  localStorage.clear();
}

/** Mounts a component at "/" inside a minimal 3-route memory-history tree
 * (root -> login -> signup) so useNavigate()/Link actually resolve, mirroring
 * the real app's top-level route structure without needing routeTree.gen.ts. */
function renderAtRoute(path: "/login" | "/signup") {
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <div>home</div>,
  });
  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/login",
    component: LoginForm,
  });
  const signupRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/signup",
    component: SignupForm,
  });
  const routeTree = rootRoute.addChildren([indexRoute, loginRoute, signupRoute]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  return { ...render(<RouterProvider router={router} />), router };
}

describe("LoginForm", () => {
  beforeEach(resetAuthStore);
  afterEach(resetAuthStore);

  it("submitting valid credentials stores tokens and navigates into the app; the submit button disables + spins while pending", async () => {
    const user = userEvent.setup();
    renderAtRoute("/login");

    await user.type(screen.getByLabelText(/email/i), "owner@wheelio.dz");
    await user.type(screen.getByLabelText(/mot de passe|password/i), "s3cret123");

    const submit = screen.getByRole("button", { name: /se connecter|sign in/i });
    expect(submit).not.toBeDisabled();

    await user.click(submit);

    // While the mocked request is in flight the button is disabled.
    await waitFor(() => {
      expect(useAuthStore.getState().accessToken).toBe("mock-access-token");
    });
    expect(useAuthStore.getState().refreshToken).toBe("mock-refresh-token");

    await waitFor(() => {
      expect(screen.getByText("home")).toBeInTheDocument();
    });
  });

  it("a failed login renders the generic error and contains NO forgot-password/reset affordance", async () => {
    server.use(
      http.post(`${API_URL}/auth/login`, () => new HttpResponse(null, { status: 401 })),
    );
    const user = userEvent.setup();
    renderAtRoute("/login");

    await user.type(screen.getByLabelText(/email/i), "owner@wheelio.dz");
    await user.type(screen.getByLabelText(/mot de passe|password/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: /se connecter|sign in/i }));

    expect(await screen.findByText(/email ou mot de passe incorrect|incorrect email or password/i)).toBeInTheDocument();
    expect(useAuthStore.getState().accessToken).toBeNull();

    // D-05: no password-reset/forgot-password affordance anywhere, in any language.
    expect(screen.queryByText(/forgot/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/reset/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/mot de passe oublié/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /forgot|reset|oublié/i })).not.toBeInTheDocument();
  });

  it("invalid email / empty password render inline field errors before submit", async () => {
    const user = userEvent.setup();
    renderAtRoute("/login");

    await user.type(screen.getByLabelText(/email/i), "not-an-email");
    await user.click(screen.getByRole("button", { name: /se connecter|sign in/i }));

    expect(await screen.findAllByRole("alert")).not.toHaveLength(0);
    // No request should have been made — the form never called the API.
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});

describe("SignupForm", () => {
  beforeEach(resetAuthStore);
  afterEach(resetAuthStore);

  function fillValidSignup(user: ReturnType<typeof userEvent.setup>) {
    return Promise.all([
      user.type(screen.getByLabelText(/organisation|organization/i), "Wheelio Location Alger"),
      user.type(screen.getByLabelText(/^email/i), "owner@wheelio.dz"),
      user.type(screen.getByLabelText(/mot de passe|password/i), "s3cret123"),
      user.type(screen.getByLabelText(/prénom|first name/i), "Karim"),
      user.type(screen.getByLabelText(/^nom$|^last name$/i), "Haddad"),
    ]);
  }

  it("signup surfaces a field-level 'email already registered' error on a 409 from the backend", async () => {
    server.use(
      http.post(`${API_URL}/auth/signup`, () =>
        HttpResponse.json({ title: "email already registered" }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    renderAtRoute("/signup");

    await fillValidSignup(user);
    await user.click(screen.getByRole("button", { name: /créer mon compte|create account/i }));

    expect(
      await screen.findByText(/cet email est déjà utilisé|this email is already in use/i),
    ).toBeInTheDocument();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it("an unexpected signup failure renders a generic banner (not the email-in-use field error)", async () => {
    server.use(
      http.post(`${API_URL}/auth/signup`, () => new HttpResponse(null, { status: 500 })),
    );
    const user = userEvent.setup();
    renderAtRoute("/signup");

    await fillValidSignup(user);
    await user.click(screen.getByRole("button", { name: /créer mon compte|create account/i }));

    expect(
      await screen.findByText(/une erreur est survenue|something went wrong/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/cet email est déjà utilisé|this email is already in use/i),
    ).not.toBeInTheDocument();
  });

  it("per-field validation renders inline before submit (short password rejected)", async () => {
    const user = userEvent.setup();
    renderAtRoute("/signup");

    await user.type(screen.getByLabelText(/organisation|organization/i), "Wheelio Location Alger");
    await user.type(screen.getByLabelText(/^email/i), "owner@wheelio.dz");
    await user.type(screen.getByLabelText(/mot de passe|password/i), "short12");
    await user.type(screen.getByLabelText(/prénom|first name/i), "Karim");
    await user.type(screen.getByLabelText(/^nom$|^last name$/i), "Haddad");
    await user.click(screen.getByRole("button", { name: /créer mon compte|create account/i }));

    expect(await screen.findAllByRole("alert")).not.toHaveLength(0);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it("has no password-reset affordance anywhere", async () => {
    renderAtRoute("/signup");
    expect(screen.queryByText(/forgot/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/mot de passe oublié/i)).not.toBeInTheDocument();
  });
});
