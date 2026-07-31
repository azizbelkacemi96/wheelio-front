/**
 * Login form — email + password, react-hook-form + zodResolver(loginSchema).
 *
 * Failure is deliberately generic (D-06): the same "email ou mot de passe
 * incorrect" copy renders whether the email is unknown or the password is
 * wrong, mirroring wheelio-api's own anti-enumeration timing-equalizer.
 * There is no password-reset link or placeholder anywhere on this screen
 * (D-05) — only a cross-link to the signup screen (D-07).
 */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
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
import { login } from "./api";
import { loginSchema, type LoginInput } from "./schemas";

export function LoginForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setTokens = useAuthStore((state) => state.setTokens);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginInput) {
    setSubmitError(null);
    try {
      const res = await login(data);
      setTokens({
        accessToken: res.access_token,
        refreshToken: res.refresh_token,
        expiresAt: res.access_token_expires_at,
      });
      await navigate({ to: "/" });
    } catch {
      // D-06: never distinguish "unknown email" from "wrong password".
      setSubmitError(t("auth.loginError"));
    }
  }

  return (
    <Card className="[--card-spacing:1.5rem]">
      <CardHeader>
        <CardTitle>{t("auth.loginTitle")}</CardTitle>
        <CardDescription>{t("auth.loginSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor="login-email">{t("auth.emailLabel")}</FieldLabel>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder={t("auth.emailPlaceholder")}
                aria-invalid={!!errors.email}
                {...register("email")}
              />
              <FieldError errors={errors.email ? [errors.email] : undefined} />
            </Field>
            <Field data-invalid={!!errors.password}>
              <FieldLabel htmlFor="login-password">{t("auth.passwordLabel")}</FieldLabel>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                {...register("password")}
              />
              <FieldError errors={errors.password ? [errors.password] : undefined} />
            </Field>
            {submitError && <FieldError>{submitError}</FieldError>}
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {t("auth.loginCta")}
            </Button>
          </FieldGroup>
        </form>
        <CardDescription className="mt-4 text-center">
          {t("auth.noAccountPrompt")}{" "}
          <Link
            to="/signup"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {t("auth.goToSignup")}
          </Link>
        </CardDescription>
      </CardContent>
    </Card>
  );
}
