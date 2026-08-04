/**
 * Fleet mutations (Phase 8 — vehicle CRUD, status, mileage). Every mutation
 * invalidates ["vehicles"] so the list and any detail refetch; mileage also
 * refreshes the per-vehicle mileage history + detail (current_mileage moves).
 *
 * A 409 on status change / archive means an illegal transition (e.g. archiving
 * a rented vehicle, or a status the backend forbids) — surfaced as a friendly
 * key, never the raw problem detail.
 */
import { isHTTPError } from "ky";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  ChangeStatusBody,
  CreateVehicleBody,
  LogMileageBody,
  UpdateVehicleBody,
} from "@/types/fleet";
import {
  archiveVehicle,
  changeVehicleStatus,
  createVehicle,
  logMileage,
  updateVehicle,
} from "./api";

export function useCreateVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateVehicleBody) => createVehicle(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vehicles"] }),
  });
}

export function useUpdateVehicle(vehicleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateVehicleBody) => updateVehicle(vehicleId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vehicles"] }),
  });
}

export function useChangeVehicleStatus(vehicleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ChangeStatusBody) => changeVehicleStatus(vehicleId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vehicles"] }),
  });
}

export function useArchiveVehicle(vehicleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => archiveVehicle(vehicleId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vehicles"] }),
  });
}

export function useLogMileage(vehicleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: LogMileageBody) => logMileage(vehicleId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vehicles"] }),
  });
}

/** A status-change / archive 409 = illegal transition (e.g. a rented vehicle). */
export function statusErrorKey(error: unknown): string | null {
  if (isHTTPError(error) && error.response.status === 409) {
    return "fleet.errors.statusConflict";
  }
  return error ? "fleet.errors.statusFailed" : null;
}
