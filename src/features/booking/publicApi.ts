/**
 * Public booking API — the storefront endpoints are UNAUTHENTICATED (the org is
 * identified by its public slug), so these calls use a plain `fetch` rather than
 * the shared `api` ky client (no Bearer, no refresh single-flight). Base URL is
 * the same VITE_API_URL the rest of the app uses.
 */
import type { QuoteResponse } from "@/types/pricing";

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8080/v1";

export interface PublicAgency {
  id: string;
  name: string;
  city?: string;
}
export interface PublicClass {
  id: string;
  name: string;
  default_deposit_cents?: number;
}
export interface PublicExtra {
  id: string;
  name: string;
  category: string;
  pricing_mode: string;
  amount_cents?: number;
  percent_bp?: number;
}
export interface PublicOrg {
  name: string;
  slug: string;
  agencies: PublicAgency[];
  classes: PublicClass[];
  extras: PublicExtra[];
}
export interface ClassAvailability {
  class_id: string;
  class_name: string;
  available_count: number;
  quote: QuoteResponse;
}
export interface BookingResult {
  booking_ref: string;
  vehicle_id: string;
  quote: QuoteResponse;
}
export interface BookingBody {
  class_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;
  extra_ids?: string[];
  discount_code?: string;
  customer: {
    full_name: string;
    phone: string;
    identity_doc_number?: string;
    license_number?: string;
  };
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

const enc = encodeURIComponent;

export function getPublicOrg(slug: string): Promise<PublicOrg> {
  return fetch(`${BASE}/public/${enc(slug)}`).then((r) => json<PublicOrg>(r));
}

export function getAvailability(
  slug: string,
  from: string,
  to: string,
  extraIds: string[],
  code: string,
): Promise<ClassAvailability[]> {
  const qs = new URLSearchParams({ from, to });
  if (extraIds.length) qs.set("extra_ids", extraIds.join(","));
  if (code.trim()) qs.set("code", code.trim());
  return fetch(`${BASE}/public/${enc(slug)}/availability?${qs.toString()}`).then((r) =>
    json<ClassAvailability[]>(r),
  );
}

export function createBooking(slug: string, body: BookingBody): Promise<BookingResult> {
  return fetch(`${BASE}/public/${enc(slug)}/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => json<BookingResult>(r));
}
