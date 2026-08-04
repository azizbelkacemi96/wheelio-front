/**
 * Agencies administration (Phase 9) at /admin/agences — org-admin only. Create
 * and edit agencies, and manage each agency's members + roles (manager / agent
 * / viewer). Member rows join the membership list with the org users list to
 * show names; a role Select changes a role, and non-members can be added.
 */
import { useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { useAuthStore } from "@/shared/auth/store";
import { isOrgAdmin } from "@/shared/auth/permissions";
import type { AgencyResponse, UserResponse, AgencyRole } from "@/types/identity";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
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
import { useAgenciesAdminQuery, useMembersQuery, useUsersQuery } from "./queries";
import {
  useCreateAgency,
  useRemoveMember,
  useSetMember,
  useUpdateAgency,
} from "./mutations";
import { agencySchema, type AgencyValues } from "./schema";

const AGENCY_ROLES: readonly AgencyRole[] = ["manager", "agent", "viewer"];

export function AgenciesAdmin() {
  const { t } = useTranslation();
  const scope = useAuthStore((s) => s.scope);
  const enabled = scope != null && isOrgAdmin(scope);
  const agenciesQuery = useAgenciesAdminQuery(enabled);
  const usersQuery = useUsersQuery(enabled);

  if (!scope || !isOrgAdmin(scope)) {
    return (
      <div className="p-4 md:p-6">
        <EmptyState titleKey="admin.notAuthorizedHeading" descriptionKey="admin.notAuthorizedBody" />
      </div>
    );
  }

  const agencies = agenciesQuery.data ?? [];
  const users = usersQuery.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 md:p-6">
      <header>
        <h1 className="font-heading text-xl font-semibold text-foreground">
          {t("admin.agencies.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("admin.agencies.subtitle")}</p>
      </header>

      <CreateAgencyCard />

      {agenciesQuery.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : agenciesQuery.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {t("admin.agencies.loadError")}
        </p>
      ) : (
        agencies.map((agency) => (
          <AgencyCard key={agency.id} agency={agency} users={users} />
        ))
      )}
    </div>
  );
}

function CreateAgencyCard() {
  const { t } = useTranslation();
  const mutation = useCreateAgency();
  const form = useForm<AgencyValues>({
    resolver: zodResolver(agencySchema) as unknown as Resolver<AgencyValues>,
    defaultValues: { country_code: "DZ" },
  });

  const submit = form.handleSubmit((values) => {
    mutation.mutate(values, { onSuccess: () => form.reset({ country_code: "DZ" }) });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.agencies.createTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <AgencyFields
          form={form}
          onSubmit={submit}
          submitLabel={t("admin.agencies.createSubmit")}
          pending={mutation.isPending}
          error={mutation.isError ? t("admin.agencies.createFailed") : undefined}
          success={mutation.isSuccess ? t("admin.agencies.created") : undefined}
        />
      </CardContent>
    </Card>
  );
}

function AgencyCard({ agency, users }: { agency: AgencyResponse; users: UserResponse[] }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const mutation = useUpdateAgency(agency.id);
  const form = useForm<AgencyValues>({
    resolver: zodResolver(agencySchema) as unknown as Resolver<AgencyValues>,
    defaultValues: {
      name: agency.name,
      address_line: agency.address_line ?? "",
      city: agency.city ?? "",
      postal_code: agency.postal_code ?? "",
      country_code: agency.country_code ?? "DZ",
      phone: agency.phone ?? "",
    },
  });

  const submit = form.handleSubmit((values) => {
    mutation.mutate(values, { onSuccess: () => setEditing(false) });
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>{agency.name}</CardTitle>
        <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
          {editing ? t("admin.agencies.cancel") : t("admin.agencies.edit")}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {editing ? (
          <AgencyFields form={form} onSubmit={submit} submitLabel={t("admin.agencies.save")} pending={mutation.isPending} error={mutation.isError ? t("admin.agencies.updateFailed") : undefined} />
        ) : (
          <p className="text-sm text-muted-foreground">
            {[agency.address_line, agency.city, agency.postal_code, agency.phone]
              .filter(Boolean)
              .join(" · ") || t("admin.agencies.noDetails")}
          </p>
        )}

        <MembersSection agencyId={agency.id} users={users} />
      </CardContent>
    </Card>
  );
}

function MembersSection({ agencyId, users }: { agencyId: string; users: UserResponse[] }) {
  const { t } = useTranslation();
  const membersQuery = useMembersQuery(agencyId);
  const setMemberMutation = useSetMember(agencyId);
  const removeMutation = useRemoveMember(agencyId);
  const [addUserId, setAddUserId] = useState("");
  const [addRole, setAddRole] = useState<AgencyRole>("agent");

  const members = membersQuery.data ?? [];
  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const nonMembers = users.filter((u) => !members.some((m) => m.user_id === u.id));

  const userLabel = (id: string) => {
    const u = usersById.get(id);
    return u ? `${u.first_name} ${u.last_name}` : id;
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <span className="text-sm font-medium text-foreground">{t("admin.members.title")}</span>

      {membersQuery.isPending ? (
        <Skeleton className="h-10 w-full" />
      ) : members.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("admin.members.empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {members.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="text-sm text-foreground">{userLabel(m.user_id)}</span>
              <div className="flex items-center gap-2">
                <Select
                  value={m.role}
                  onValueChange={(role) =>
                    setMemberMutation.mutate({ userId: m.user_id, body: { role: role as AgencyRole } })
                  }
                >
                  <SelectTrigger className="w-36" aria-label={t("admin.members.role")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGENCY_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {t(`roles.${r}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t("admin.members.remove")}
                  onClick={() => removeMutation.mutate(m.user_id)}
                  disabled={removeMutation.isPending}
                >
                  <Trash2 className="size-4" aria-hidden={true} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {nonMembers.length > 0 && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <Field className="w-full sm:w-56">
            <FieldLabel htmlFor={`add-user-${agencyId}`}>{t("admin.members.addUser")}</FieldLabel>
            <Select value={addUserId} onValueChange={setAddUserId}>
              <SelectTrigger id={`add-user-${agencyId}`} className="w-full" aria-label={t("admin.members.addUser")}>
                <SelectValue placeholder={t("admin.members.selectUser")} />
              </SelectTrigger>
              <SelectContent>
                {nonMembers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.first_name} {u.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field className="w-full sm:w-36">
            <FieldLabel htmlFor={`add-role-${agencyId}`}>{t("admin.members.role")}</FieldLabel>
            <Select value={addRole} onValueChange={(r) => setAddRole(r as AgencyRole)}>
              <SelectTrigger id={`add-role-${agencyId}`} className="w-full" aria-label={t("admin.members.role")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGENCY_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`roles.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button
            size="sm"
            disabled={!addUserId || setMemberMutation.isPending}
            onClick={() =>
              addUserId &&
              setMemberMutation.mutate(
                { userId: addUserId, body: { role: addRole } },
                { onSuccess: () => setAddUserId("") },
              )
            }
          >
            {t("admin.members.add")}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Shared agency field set (create + edit). */
function AgencyFields({
  form,
  onSubmit,
  submitLabel,
  pending,
  error,
  success,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel: string;
  pending: boolean;
  error?: string;
  success?: string;
}) {
  const { t } = useTranslation();
  const err = form.formState.errors;
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field data-invalid={!!err.name}>
          <FieldLabel htmlFor="a-name">{t("admin.agencies.fields.name")}</FieldLabel>
          <Input id="a-name" aria-invalid={!!err.name} {...form.register("name")} />
          <FieldError errors={err.name ? [{ message: t("admin.agencies.errors.nameRequired") }] : undefined} />
        </Field>
        <Field>
          <FieldLabel htmlFor="a-phone">{t("admin.agencies.fields.phone")}</FieldLabel>
          <Input id="a-phone" {...form.register("phone")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="a-address">{t("admin.agencies.fields.address")}</FieldLabel>
          <Input id="a-address" {...form.register("address_line")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="a-city">{t("admin.agencies.fields.city")}</FieldLabel>
          <Input id="a-city" {...form.register("city")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="a-postal">{t("admin.agencies.fields.postalCode")}</FieldLabel>
          <Input id="a-postal" {...form.register("postal_code")} />
        </Field>
        <Field data-invalid={!!err.country_code}>
          <FieldLabel htmlFor="a-country">{t("admin.agencies.fields.countryCode")}</FieldLabel>
          <Input id="a-country" maxLength={2} {...form.register("country_code")} />
          <FieldError errors={err.country_code ? [{ message: t("admin.agencies.errors.countryCode") }] : undefined} />
        </Field>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">
          {success}
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
