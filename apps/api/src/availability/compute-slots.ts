import { DateTime, Interval } from 'luxon';

/**
 * Availability engine: a pure function, with no database access, so every edge
 * case (split shifts, buffers, time off, daylight saving changes) can be unit
 * tested in isolation.
 *
 * Time model:
 * - Working hours are wall-clock times in the business's time zone
 *   ("Mondays 09:00-13:00"), because that's how businesses think.
 * - Everything else (time off, bookings, the returned slots) are absolute
 *   instants (UTC), because that's what can be compared safely.
 * The conversion happens per calendar day, in the business's zone, so a
 * daylight saving change moves the UTC instants while the local schedule stays
 * the same.
 */

export interface WorkingInterval {
  /** ISO weekday: 1 = Monday ... 7 = Sunday. */
  weekday: number;
  /** Minutes since local midnight. */
  startMinute: number;
  endMinute: number;
}

export interface BusyPeriod {
  startsAt: Date;
  endsAt: Date;
}

export interface StaffSchedule {
  staffId: string;
  workingHours: WorkingInterval[];
  /** Time off and existing bookings (bookings already include their buffer). */
  busy: BusyPeriod[];
}

export interface ComputeSlotsInput {
  timezone: string;
  staff: StaffSchedule[];
  durationMin: number;
  /** Extra minutes blocked after the appointment (cleanup, travel...). */
  bufferMin: number;
  /** First and last local calendar day to compute, inclusive ("2026-12-01"). */
  fromDate: string;
  toDate: string;
  /** Slots starting before this instant are not offered (now + minimum notice). */
  earliestStart: Date;
  /** Distance between candidate start times. */
  stepMin?: number;
}

export interface Slot {
  /** Start instant, ISO 8601 in UTC. */
  start: string;
  /** End of the appointment itself (without the buffer). */
  end: string;
  /** Local date and time in the business's zone, handy for display. */
  localDate: string;
  localTime: string;
  /** Staff members free at this time, so the customer can pick one or "anyone". */
  staffIds: string[];
}

export function computeAvailableSlots(input: ComputeSlotsInput): Slot[] {
  const { timezone, durationMin, bufferMin, stepMin = 15 } = input;
  const earliest = DateTime.fromJSDate(input.earliestStart);
  const firstDay = DateTime.fromISO(input.fromDate, { zone: timezone });
  const lastDay = DateTime.fromISO(input.toDate, { zone: timezone });
  if (!firstDay.isValid || !lastDay.isValid)
    throw new Error('Invalid date range');

  // start instant (ms) -> slot, so the same time offered by several staff
  // members becomes a single slot listing all of them.
  const slots = new Map<number, Slot>();

  for (let day = firstDay; day <= lastDay; day = day.plus({ days: 1 })) {
    for (const member of input.staff) {
      const busy = member.busy.map((b) =>
        Interval.fromDateTimes(
          DateTime.fromJSDate(b.startsAt),
          DateTime.fromJSDate(b.endsAt),
        ),
      );

      for (const hours of member.workingHours) {
        if (hours.weekday !== day.weekday) continue;
        const open = atLocalMinute(day, hours.startMinute);
        const close = atLocalMinute(day, hours.endMinute);

        for (let start = open; ; start = start.plus({ minutes: stepMin })) {
          const end = start.plus({ minutes: durationMin });
          // The appointment must end by closing time; the buffer may spill over.
          if (end > close) break;
          if (start < earliest) continue;

          const blocked = Interval.fromDateTimes(
            start,
            end.plus({ minutes: bufferMin }),
          );
          if (busy.some((b) => b.overlaps(blocked))) continue;

          const key = start.toMillis();
          const slot = slots.get(key) ?? {
            start: start.toUTC().toISO()!,
            end: end.toUTC().toISO()!,
            localDate: start.toISODate()!,
            localTime: start.toFormat('HH:mm'),
            staffIds: [],
          };
          if (!slot.staffIds.includes(member.staffId))
            slot.staffIds.push(member.staffId);
          slots.set(key, slot);
        }
      }
    }
  }

  return [...slots.entries()].sort(([a], [b]) => a - b).map(([, slot]) => slot);
}

/**
 * The instant at which the local clock shows `minute` minutes after midnight
 * on `day`. Built from wall-clock fields (not by adding minutes to midnight) so
 * that on a daylight saving day "09:00" is still 09:00 local time. A time that
 * doesn't exist (skipped by a spring-forward jump) moves forward to a valid one.
 */
function atLocalMinute(day: DateTime, minute: number): DateTime {
  if (minute === 1440) return day.plus({ days: 1 }).startOf('day');
  return day.set({
    hour: Math.floor(minute / 60),
    minute: minute % 60,
    second: 0,
    millisecond: 0,
  });
}
