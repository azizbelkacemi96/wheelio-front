/**
 * Signup form — organization_name, email, password, first_name, last_name.
 * A plain in-app screen (D-07: reachable like login, not a public
 * marketing/self-serve site). No password-reset link/placeholder anywhere
 * (D-05).
 *
 * A 409 from wheelio-api's `/auth/signup` means the email is already
 * registered — surfaced as a field-level error on the email input. Any
 * other failure (network error, 5xx, etc.) renders a generic banner; the
 * two are deliberately distinct because "email already in use" is
 * information the user needs to act on (pick another email / go log in),
 * unlike the login screen's intentionally-generic D-06 error.
 */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { isHTTPError } from "ky";
import "@/shared/i18n";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/shared/ui/field";
import { useAuthStore } from "@/shared/auth/store";
import { signup } from "./api";
import { signupSchema, type SignupInput } from "./schemas";

export function SignupForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setTokens = useAuthStore((state) => state.setTokens);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) });

  async function onSubmit(data: SignupInput) {
    setSubmitError(null);
    try {
      const res = await signup(data);
      setTokens({
        accessToken: res.access_token,
        refreshToken: res.refresh_token,
        expiresAt: res.access_token_expires_at,
      });
      await navigate({ to: "/" });
    } catch (err) {
      if (isHTTPError(err) && err.response.status === 409) {
        setError("email", { message: t("auth.signupEmailInUse") });
        return;
      }
      setSubmitError(t("auth.genericError"));
    }
  }

  return (
    <Card className="[--card-spacing:1.5rem]">
      <CardHeader>
        <CardTitle>{t("auth.signupTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={!!errors.organization_name}>
              <FieldLabel htmlFor="signup-org-name">
                {t("auth.organizationNameLabel")}
              </FieldLabel>
              {/* min-w-0 (Input's own base class) prevents a long organization
                  name from ever growing the auth card horizontally — the
                  input scrolls its own overflowed text instead (long-text
                  backstop). */}
              <Input
                id="signup-org-name"
                type="text"
                autoComplete="organization"
                aria-invalid={!!errors.organization_name}
                {...register("organization_name")}
              />
              <FieldError
                errors={errors.organization_name ? [errors.organization_name] : undefined}
              />
            </Field>
            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor="signup-email">{t("auth.emailLabel")}</FieldLabel>
              <Input
                id="signup-email"
                type="email"
                autoComplete="email"
                placeholder={t("auth.emailPlaceholder")}
                aria-invalid={!!errors.email}
                {...register("email")}
              />
              <FieldError errors={errors.email ? [errors.email] : undefined} />
            </Field>
            <Field data-invalid={!!errors.password}>
              <FieldLabel htmlFor="signup-password">{t("auth.passwordLabel")}</FieldLabel>
              <Input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={!!errors.password}
                {...register("password")}
              />
              <FieldError errors={errors.password ? [errors.password] : undefined} />
            </Field>
            <Field data-invalid={!!errors.first_name}>
              <FieldLabel htmlFor="signup-first-name">{t("auth.firstNameLabel")}</FieldLabel>
              <Input
                id="signup-first-name"
                type="text"
                autoComplete="given-name"
                aria-invalid={!!errors.first_name}
                {...register("first_name")}
              />
              <FieldError errors={errors.first_name ? [errors.first_name] : undefined} />
            </Field>
            <Field data-invalid={!!errors.last_name}>
              <FieldLabel htmlFor="signup-last-name">{t("auth.lastNameLabel")}</FieldLabel>
              <Input
                id="signup-last-name"
                type="text"
                autoComplete="family-name"
                aria-invalid={!!errors.last_name}
                {...register("last_name")}
              />
              <FieldError errors={errors.last_name ? [errors.last_name] : undefined} />
            </Field>
            {submitError && <FieldError>{submitError}</FieldError>}
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {t("auth.signupCta")}
            </Button>
          </FieldGroup>
        </form>
        <CardDescription className="mt-4 text-center">
          {t("auth.hasAccountPrompt")}{" "}
          <Link
            to="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {t("auth.goToLogin")}
          </Link>
        </CardDescription>
      </CardContent>
    </Card>
  );
}
