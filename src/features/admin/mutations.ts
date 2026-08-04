/**
 * Admin mutations (Phase 9). User create invalidates ["users"]; agency
 * create/edit invalidates ["agencies"] (also refreshing the switcher); member
 * set/remove invalidates that agency's ["members", id].
 *
 * A create-user 409 = the email is already registered (surfaced friendly).
 */
import { isHTTPError } from "ky";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AgencyBody, CreateUserBody, SetMemberBody } from "@/types/identity";
import {
  createAgency,
  createUser,
  removeMember,
  setMember,
  updateAgency,
} from "./api";

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateUserBody) => createUser(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useCreateAgency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AgencyBody) => createAgency(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agencies"] }),
  });
}

export function useUpdateAgency(agencyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AgencyBody) => updateAgency(agencyId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agencies"] }),
  });
}

export function useSetMember(agencyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, body }: { userId: string; body: SetMemberBody }) =>
      setMember(agencyId, userId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members", agencyId] }),
  });
}

export function useRemoveMember(agencyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeMember(agencyId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members", agencyId] }),
  });
}

/** A create-user 409 means the email is already registered. */
export function createUserErrorKey(error: unknown): string | null {
  if (isHTTPError(error) && error.response.status === 409) {
    return "admin.users.errors.emailInUse";
  }
  return error ? "admin.users.errors.createFailed" : null;
}
