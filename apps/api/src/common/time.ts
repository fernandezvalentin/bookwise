/**
 * Working hours travel over the API as "HH:mm" (easy to read and write) and are
 * stored as minutes since local midnight (easy to compare and do math with).
 */

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$|^24:00$/;

export function isTimeOfDay(value: string): boolean {
  return TIME_PATTERN.test(value);
}

/** "09:30" -> 570. "24:00" is allowed as the end of the day (1440). */
export function timeToMinutes(value: string): number {
  if (!isTimeOfDay(value)) throw new Error(`Invalid time of day: ${value}`);
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

/** 570 -> "09:30". */
export function minutesToTime(totalMinutes: number): string {
  if (
    !Number.isInteger(totalMinutes) ||
    totalMinutes < 0 ||
    totalMinutes > 1440
  ) {
    throw new Error(`Invalid minutes of day: ${totalMinutes}`);
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** True when the string is a time zone the runtime knows (IANA name or alias). */
export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
