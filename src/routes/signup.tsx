import { createFileRoute } from "@tanstack/react-router";
import { SignupForm } from "@/features/auth/SignupForm";

// Public route (not under "/_authenticated") — an in-app convenience screen
// reachable like login, not a public marketing/self-serve site (D-07).
export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  return (
    <div className="relative flex min-h-svh items-center justify-center bg-background p-4">
      <div className="auth-gradient-bg absolute inset-0 opacity-10" aria-hidden="true" />
      <div className="relative z-10 w-full max-w-sm">
        <SignupForm />
      </div>
    </div>
  );
}
