/**
 * Users administration (Phase 9) at /admin/utilisateurs — org-admin only.
 * Lists the organization's users and creates new ones (admin | member). Owner
 * is reserved to the signup founder, so the create form offers admin/member.
 */
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/shared/auth/store";
import { isOrgAdmin } from "@/shared/auth/permissions";
import { useLocale } from "@/shared/i18n/useLocale";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { EmptyState } from "@/shared/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Field, FieldError, FieldLabel } from "@/shared/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { useUsersQuery } from "./queries";
import { createUserErrorKey, useCreateUser } from "./mutations";
import { ORG_ROLES, createUserSchema, type CreateUserValues } from "./schema";

export function UsersAdmin() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const scope = useAuthStore((s) => s.scope);
  const usersQuery = useUsersQuery(scope != null && isOrgAdmin(scope));

  if (!scope || !isOrgAdmin(scope)) {
    return (
      <div className="p-4 md:p-6">
        <EmptyState
          titleKey="admin.notAuthorizedHeading"
          descriptionKey="admin.notAuthorizedBody"
        />
      </div>
    );
  }

  const users = usersQuery.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 md:p-6">
      <header>
        <h1 className="font-heading text-xl font-semibold text-foreground">
          {t("admin.users.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("admin.users.subtitle")}</p>
      </header>

      <CreateUserCard />

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.users.listTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {usersQuery.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : usersQuery.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {t("admin.users.loadError")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-3 py-2">{t("admin.users.columns.name")}</TableHead>
                    <TableHead className="px-3 py-2">{t("admin.users.columns.email")}</TableHead>
                    <TableHead className="px-3 py-2">{t("admin.users.columns.role")}</TableHead>
                    <TableHead className="px-3 py-2">{t("admin.users.columns.status")}</TableHead>
                    <TableHead className="px-3 py-2">{t("admin.users.columns.since")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="px-3 py-2 font-medium">
                        {u.first_name} {u.last_name}
                      </TableCell>
                      <TableCell className="px-3 py-2">{u.email}</TableCell>
                      <TableCell className="px-3 py-2">
                        <Badge variant={u.org_role === "member" ? "secondary" : "default"}>
                          {t(`roles.${u.org_role}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <Badge variant={u.is_active ? "outline" : "destructive"}>
                          {u.is_active ? t("admin.users.active") : t("admin.users.inactive")}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3 py-2 text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString(locale)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CreateUserCard() {
  const { t } = useTranslation();
  const mutation = useCreateUser();
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema) as unknown as Resolver<CreateUserValues>,
    defaultValues: { org_role: "member" },
  });

  const submit = handleSubmit((values) => {
    mutation.mutate(values, {
      onSuccess: () => reset({ org_role: "member", first_name: "", last_name: "", email: "", password: "" }),
    });
  });

  const errorKey = createUserErrorKey(mutation.error);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.users.createTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField id="u-first" label={t("admin.users.fields.firstName")} error={errors.first_name?.message} reg={register("first_name")} />
            <TextField id="u-last" label={t("admin.users.fields.lastName")} error={errors.last_name?.message} reg={register("last_name")} />
            <TextField id="u-email" type="email" label={t("admin.users.fields.email")} error={errors.email?.message} reg={register("email")} />
            <TextField id="u-pass" type="password" label={t("admin.users.fields.password")} error={errors.password?.message} reg={register("password")} />
            <Field>
              <FieldLabel htmlFor="u-role">{t("admin.users.fields.role")}</FieldLabel>
              <Controller
                control={control}
                name="org_role"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="u-role" className="w-full" aria-label={t("admin.users.fields.role")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORG_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {t(`roles.${r}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>
          {errorKey && (
            <p role="alert" className="text-sm text-destructive">
              {t(errorKey)}
            </p>
          )}
          {mutation.isSuccess && (
            <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">
              {t("admin.users.created")}
            </p>
          )}
          <div>
            <Button type="submit" disabled={mutation.isPending}>
              {t("admin.users.createSubmit")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function TextField({
  id,
  label,
  error,
  reg,
  type = "text",
}: {
  id: string;
  label: string;
  error?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reg: any;
  type?: string;
}) {
  const { t } = useTranslation();
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} type={type} aria-invalid={!!error} {...reg} />
      <FieldError errors={error ? [{ message: t(error) }] : undefined} />
    </Field>
  );
}
