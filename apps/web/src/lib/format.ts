import { DateTime } from 'luxon';

/** Prices are stored in cents: 1500000 -> "$15,000". */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

/** 30 -> "30 min", 90 -> "1 h 30 min". */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** "2026-11-30" -> "Mon, Nov 30". */
export function formatDay(localDate: string): string {
  return DateTime.fromISO(localDate).toFormat('ccc, LLL d');
}

/** "2026-11-30" -> "Monday, November 30, 2026". */
export function formatLongDay(localDate: string): string {
  return DateTime.fromISO(localDate).toFormat('cccc, LLLL d, yyyy');
}

/** Local date and time of an instant in a time zone. */
export function localParts(isoInstant: string, timezone: string) {
  const local = DateTime.fromISO(isoInstant).setZone(timezone);
  return { localDate: local.toISODate()!, localTime: local.toFormat('HH:mm') };
}

/** The next `count` calendar days in a time zone, starting today. */
export function upcomingDays(timezone: string, count: number): string[] {
  const today = DateTime.now().setZone(timezone).startOf('day');
  return Array.from({ length: count }, (_, i) =>
    today.plus({ days: i }).toISODate()!,
  );
}

/** "America/Argentina/Buenos_Aires" -> "Buenos Aires time". */
export function timezoneLabel(timezone: string): string {
  const city = timezone.split('/').at(-1)?.replaceAll('_', ' ');
  return city ? `${city} time` : timezone;
}
