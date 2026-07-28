/**
 * Africa/Algiers day-key math for the OPS-01 today overview.
 *
 * Algeria is a FIXED UTC+1 with no DST, but "today" must still be computed in
 * the Algiers zone, not UTC. A naive `iso.slice(0, 10)` (or
 * `new Date(iso).toISOString().slice(0, 10)`) is off by one near midnight: a
 * pickup at 00:30 Algiers time is still 23:30 UTC the previous day, so UTC
 * slicing files it under yesterday. `Intl.DateTimeFormat` with an explicit
 * `timeZone` renders the wall-clock date in Algiers and sidesteps the bug.
 */

const ALGIERS = "Africa/Algiers";

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ALGIERS,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "YYYY-MM-DD" for the given RFC3339 timestamp, in Africa/Algiers local time. */
export function dayKeyAlgiers(iso: string): string {
  return dayKeyFormatter.format(new Date(iso));
}

/**
 * True when `iso` falls on the same Algiers calendar day as `now`. `now` is
 * injectable so the near-midnight boundary is testable without a real clock.
 */
export function isTodayAlgiers(iso: string, now: Date = new Date()): boolean {
  return dayKeyAlgiers(iso) === dayKeyAlgiers(now.toISOString());
}

/**
 * Turns a zone-less `datetime-local` value ("YYYY-MM-DDTHH:mm") into a valid
 * RFC3339 timestamp by appending seconds and Algeria's fixed +01:00 offset —
 * accepted by the backend's `datetime=2006-01-02T15:04:05Z07:00` validator.
 */
export function toRFC3339Algiers(local: string): string {
  return `${local}:00+01:00`;
}
