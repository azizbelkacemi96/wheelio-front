/**
 * Admin read layer. Agencies reuse the ["agencies"] key shared with the
 * top-bar switcher so a create/edit here refreshes the switcher too.
 */
import { useQuery } from "@tanstack/react-query";
import { listAgencies, listMembers, listUsers } from "./api";

export function useUsersQuery(enabled = true) {
  return useQuery({ queryKey: ["users"], queryFn: listUsers, enabled });
}

export function useAgenciesAdminQuery(enabled = true) {
  return useQuery({ queryKey: ["agencies"], queryFn: listAgencies, enabled });
}

export function useMembersQuery(agencyId: string, enabled = true) {
  return useQuery({
    queryKey: ["members", agencyId],
    queryFn: () => listMembers(agencyId),
    enabled: enabled && agencyId !== "",
  });
}
