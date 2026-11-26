import type { WorkingInterval } from './types';

/**
 * Weekly schedule helpers, shared by the schedule editor (client) and the
 * server action. No Luxon here, so the client bundle stays small.
 */

export const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export interface TimeRange {
  start: string;
  end: string;
}

/** API intervals -> seven lists of ranges, Monday first. */
export function groupByWeekday(intervals: WorkingInterval[]): TimeRange[][] {
  const days: TimeRange[][] = WEEKDAYS.map(() => []);
  for (const { weekday, start, end } of intervals) {
    days[weekday - 1]?.push({ start, end });
  }
  for (const day of days) day.sort((a, b) => a.start.localeCompare(b.start));
  return days;
}

/** Seven lists of ranges -> API intervals. */
export function flattenWeek(days: TimeRange[][]): WorkingInterval[] {
  return days.flatMap((ranges, i) =>
    ranges.map((r) => ({ weekday: i + 1, start: r.start, end: r.end })),
  );
}

/** "09:00-13:00, 14:00-18:00", or "Closed". */
export function describeDay(ranges: TimeRange[]): string {
  return ranges.length === 0
    ? 'Closed'
    : ranges.map((r) => `${r.start}–${r.end}`).join(', ');
}
