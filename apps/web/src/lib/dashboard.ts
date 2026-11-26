import { DateTime } from 'luxon';

/**
 * Pure date and number helpers for the business dashboard. Dates are local
 * calendar dates ("2026-12-07") in the business's time zone, the same format
 * the API uses for the agenda.
 */

export type AgendaView = 'day' | 'week';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's date in a time zone. */
export function todayIn(timezone: string): string {
  return DateTime.now().setZone(timezone).toISODate()!;
}

/** "2026-12-07" is a real calendar date (rejects "2026-02-30"). */
export function isLocalDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    ISO_DATE.test(value) &&
    DateTime.fromISO(value).isValid
  );
}

/** Dates shown by the agenda: one day, or Monday to Sunday of its week. */
export function agendaDays(date: string, view: AgendaView): string[] {
  if (view === 'day') return [date];
  const monday = DateTime.fromISO(date).startOf('week'); // ISO weeks start on Monday
  return Array.from({ length: 7 }, (_, i) =>
    monday.plus({ days: i }).toISODate()!,
  );
}

/** The previous or next day or week. */
export function shiftDate(
  date: string,
  view: AgendaView,
  direction: -1 | 1,
): string {
  const unit = view === 'day' ? { days: direction } : { weeks: direction };
  return DateTime.fromISO(date).plus(unit).toISODate()!;
}

/** "Dec 7 – 13, 2026", or "Dec 28, 2026 – Jan 3, 2027" across years. */
export function formatRange(from: string, to: string): string {
  const a = DateTime.fromISO(from);
  const b = DateTime.fromISO(to);
  if (a.year !== b.year)
    return `${a.toFormat('LLL d, yyyy')} – ${b.toFormat('LLL d, yyyy')}`;
  if (a.month !== b.month)
    return `${a.toFormat('LLL d')} – ${b.toFormat('LLL d, yyyy')}`;
  return `${a.toFormat('LLL d')} – ${b.toFormat('d, yyyy')}`;
}

/** "15000" or "15000.50" (dollars, as typed in a form) -> cents. Null if invalid. */
export function parsePriceToCents(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  return Math.round(Number(trimmed) * 100);
}

/** Cents -> the value for a price input: 1500050 -> "15000.50". */
export function centsToInput(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/**
 * A `datetime-local` input value ("2026-12-24T09:00") read as a time in the
 * business's zone, as an ISO instant with offset. Null if invalid.
 */
export function localInputToInstant(
  value: unknown,
  timezone: string,
): string | null {
  if (typeof value !== 'string' || !value) return null;
  const local = DateTime.fromISO(value, { zone: timezone });
  return local.isValid ? local.toISO({ suppressMilliseconds: true }) : null;
}

/** An instant in the business's zone: "Dec 24, 2026 09:00". */
export function formatInstant(isoInstant: string, timezone: string): string {
  return DateTime.fromISO(isoInstant)
    .setZone(timezone)
    .toFormat('LLL d, yyyy HH:mm');
}

/** The instant is still in the future (a booking that can be cancelled). */
export function hasNotStarted(isoInstant: string): boolean {
  return new Date(isoInstant).getTime() > Date.now();
}
