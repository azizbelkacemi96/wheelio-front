/**
 * Inspection mutations (INSP-01/03). Mirrors contracts/mutations.ts idioms.
 *
 * Creating a `return` inspection with no VALIDATED departure yields a 409
 * (05-RESEARCH.md Pitfall 6); `needDepartureErrorKey` maps that to a friendly
 * key kept out of the raw problem.detail. Validating a `return` inspection
 * triggers backend side-effects (vehicle → available, mileage, auto-
 * maintenance) — so a successful validate invalidates ["contracts"] and
 * ["vehicles"] as well as the inspection.
 */
import { isHTTPError } from "ky";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  CreateInspectionBody,
  RecordDamageBody,
} from "@/types/inspection";
import { createInspection, recordDamage, validateInspection } from "./api";

export interface CreateInspectionInput {
  contractId: string;
  body: CreateInspectionBody;
}

export function useCreateInspection() {
  return useMutation({
    mutationFn: ({ contractId, body }: CreateInspectionInput) =>
      createInspection(contractId, body),
  });
}

export interface RecordDamageInput {
  inspectionId: string;
  body: RecordDamageBody;
}

export function useRecordDamage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ inspectionId, body }: RecordDamageInput) =>
      recordDamage(inspectionId, body),
    onSuccess: (_data, { inspectionId }) =>
      queryClient.invalidateQueries({
        queryKey: ["inspections", "damages", inspectionId],
      }),
  });
}

export function useValidateInspection(inspectionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => validateInspection(inspectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inspections", "detail", inspectionId] });
      // Validating a return flips the vehicle to available + records mileage.
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });
}

function isHTTPStatus(error: unknown, status: number): boolean {
  return isHTTPError(error) && error.response.status === status;
}

/** A CREATE-time 409 means a `return` was requested with no validated
 * departure. Returns the friendly key, or null for any other error. */
export function needDepartureErrorKey(error: unknown): string | null {
  return isHTTPStatus(error, 409) ? "inspections.errors.needDeparture" : null;
}

/** A VALIDATE-time 400 means a damage still has no attached photo — the
 * backend gate fired despite the client gate (defense in depth). */
export function photoRequiredErrorKey(error: unknown): string | null {
  return isHTTPStatus(error, 400) ? "inspections.errors.photoRequired" : null;
}
