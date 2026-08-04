/**
 * Booking admin API (authenticated) — set/read the org's public booking slug.
 * Uses the shared `api` ky client (Bearer + refresh). The public storefront
 * endpoints live in publicApi.ts (unauthenticated).
 */
import { api } from "@/shared/api/client";

export interface BookingSlug {
  slug: string;
  active: boolean;
}

export function getBookingSlug(): Promise<BookingSlug> {
  return api.get("organization/booking-slug").json<BookingSlug>();
}

export function setBookingSlug(slug: string, active = true): Promise<BookingSlug> {
  return api.put("organization/booking-slug", { json: { slug, active } }).json<BookingSlug>();
}
