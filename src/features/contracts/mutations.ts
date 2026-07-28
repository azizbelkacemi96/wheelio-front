/**
 * Rental lifecycle mutations (D-06) — mirrors customers/mutations.ts idioms.
 *
 * Every lifecycle mutation invalidates BOTH ["contracts"] and ["vehicles"] on
 * success: activate -> vehicle becomes `rented`, close -> `available`, cancel
 * of an active contract -> `available`. The vehicle status is a side effect of
 * the contract transition, so both caches must refetch (04-RESEARCH.md
 * Pattern 1).
 *
 * 409 is AMBIGUOUS across mutations (Pitfall 2). On CREATE it means an overlap
 * (double-booking rejected by the DB EXCLUDE constraint). On
 * activate/close/cancel it means an illegal status transition — the UI is
 * stale, someone already advanced the contract. `overlapErrorKey` and
 * `transitionErrorKey` map the SAME status code to different friendly i18n
 * keys per mutation. Callers surface only the i18n key, never the raw
 * problem.detail (threat T-04-04), and after a transition 409 should refetch
 * the contract to re-gate its buttons (T-04-05).
 */
import { isHTTPError } from "ky";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  ActivateBody,
  CancelBody,
  CloseBody,
  CreateContractBody,
  DepositBody,
} from "@/types/rental";
import {
  activateContract,
  cancelContract,
  closeContract,
  createContract,
  recordDeposit,
} from "./api";

/** Invalidate both namespaces after a lifecycle change (D-06). */
function invalidateBoth(queryClient: ReturnType<typeof useQueryClient>): void {
  queryClient.invalidateQueries({ queryKey: ["contracts"] });
  queryClient.invalidateQueries({ queryKey: ["vehicles"] });
}

export interface CreateContractInput {
  vehicleId: string;
  body: CreateContractBody;
}

export function useCreateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ vehicleId, body }: CreateContractInput) =>
      createContract(vehicleId, body),
    onSuccess: () => invalidateBoth(queryClient),
  });
}

export function useActivate(contractId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ActivateBody) => activateContract(contractId, body),
    onSuccess: () => invalidateBoth(queryClient),
  });
}

export function useClose(contractId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CloseBody) => closeContract(contractId, body),
    onSuccess: () => invalidateBoth(queryClient),
  });
}

export function useCancel(contractId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CancelBody) => cancelContract(contractId, body),
    onSuccess: () => invalidateBoth(queryClient),
  });
}

export function useRecordDeposit(contractId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: DepositBody) => recordDeposit(contractId, body),
    onSuccess: () => invalidateBoth(queryClient),
  });
}

/** True when `error` is an HTTP error carrying the given status. */
function isHTTPStatus(error: unknown, status: number): boolean {
  return isHTTPError(error) && error.response.status === status;
}

/**
 * Maps a CREATE-time 409 to the overlap key. Used ONLY by the create call —
 * on create, a 409 always means the requested period overlaps an existing
 * booking. Returns null for any non-409 / non-HTTP error.
 */
export function overlapErrorKey(error: unknown): string | null {
  return isHTTPStatus(error, 409) ? "contracts.errors.overlap" : null;
}

const TRANSITION_KEYS = {
  activate: "contracts.errors.notReservable",
  close: "contracts.errors.notClosable",
  cancel: "contracts.errors.notCancellable",
} as const;

/**
 * Maps a lifecycle-action 409 to its DISTINCT illegal-transition key (stale
 * UI). A create 409 and a transition 409 are deliberately mapped differently
 * (Pitfall 2). Returns null for any non-409 / non-HTTP error.
 */
export function transitionErrorKey(
  kind: "activate" | "close" | "cancel",
  error: unknown,
): string | null {
  return isHTTPStatus(error, 409) ? TRANSITION_KEYS[kind] : null;
}
