import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { LoginForm } from "@/features/auth/LoginForm";

// Public route (not under "/_authenticated") — reachable without a session.
// `reason=session-expired` is set by `_authenticated.tsx`'s beforeLoad
// redirect (AUTH-02's one allowed redirect path) — see that file's comment
// for why the toast fires here rather than at redirect time.
const loginSearchSchema = z.object({
  reason: z.enum(["session-expired"]).optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: loginSearchSchema,
  component: LoginPage,
});

function LoginPage() {
  const { t } = useTranslation();
  const { reason } = Route.useSearch();

  useEffect(() => {
    if (reason === "session-expired") {
      toast.error(t("auth.sessionExpired"));
    }
    // Fire once per mount for the redirect that brought us here — not on
    // every `t` re-creation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reason]);

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
