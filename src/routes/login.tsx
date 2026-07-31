import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { AuthLayout } from "@/features/auth/AuthLayout";
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
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
}
