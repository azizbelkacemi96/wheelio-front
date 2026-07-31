import { createFileRoute } from "@tanstack/react-router";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { SignupForm } from "@/features/auth/SignupForm";

// Public route (not under "/_authenticated") — an in-app convenience screen
// reachable like login, not a public marketing/self-serve site (D-07).
export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  return (
    <AuthLayout>
      <SignupForm />
    </AuthLayout>
  );
}
