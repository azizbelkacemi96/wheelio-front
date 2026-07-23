import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "@/features/auth/LoginForm";

// Public route (not under "/_authenticated") — reachable without a session.
export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="relative flex min-h-svh items-center justify-center bg-background p-4">
      {/* Stripe-like brand gradient band (D-01) — low opacity, auth screens only. */}
      <div className="auth-gradient-bg absolute inset-0 opacity-10" aria-hidden="true" />
      <div className="relative z-10 w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  );
}
