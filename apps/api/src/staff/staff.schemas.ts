import { z } from 'zod';
import { isTimeOfDay, timeToMinutes } from '../common/time.js';

const serviceIds = z
  .array(z.uuid())
  .max(100)
  .refine(
    (ids) => new Set(ids).size === ids.length,
    'serviceIds must not repeat',
  );

export const createStaffSchema = z.strictObject({
  name: z.string().trim().min(1).max(100).meta({ example: 'Martín' }),
  /** Services this person provides. They must belong to the same business. */
  serviceIds: serviceIds.default([]),
});
export type CreateStaffDto = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = z
  .strictObject({
    name: createStaffSchema.shape.name,
    active: z.boolean(),
    /** Replaces the whole list. */
    serviceIds,
  })
  .partial();
export type UpdateStaffDto = z.infer<typeof updateStaffSchema>;

// ---------------------------------------------------------------------
//  Working hours
// ---------------------------------------------------------------------

const timeOfDay = z.string().refine(isTimeOfDay, 'Use HH:mm (00:00 to 24:00)');

export const workingIntervalSchema = z
  .strictObject({
    /** ISO weekday: 1 = Monday ... 7 = Sunday. */
    weekday: z.number().int().min(1).max(7).meta({ example: 1 }),
    start: timeOfDay.meta({ example: '09:00' }),
    end: timeOfDay.meta({ example: '13:00' }),
  })
  .refine(
    // Zod runs object-level checks even when a field already failed: skip
    // invalid times here (their own error is reported) instead of throwing.
    (i) => !bothValid(i) || timeToMinutes(i.end) > timeToMinutes(i.start),
    { message: 'end must be after start', path: ['end'] },
  );

function bothValid(i: { start: string; end: string }) {
  return isTimeOfDay(i.start) && isTimeOfDay(i.end);
}

/** The full weekly schedule. PUT replaces it entirely. */
export const weeklyScheduleSchema = z
  .array(workingIntervalSchema)
  .max(50)
  .superRefine((intervals, ctx) => {
    const overlap = findOverlap(intervals);
    if (overlap) {
      ctx.addIssue({
        code: 'custom',
        message: `Intervals overlap on weekday ${overlap.weekday}: ${overlap.a} and ${overlap.b}`,
      });
    }
  });
export type WeeklyScheduleDto = z.infer<typeof weeklyScheduleSchema>;

function findOverlap(
  intervals: { weekday: number; start: string; end: string }[],
) {
  const sorted = intervals
    .filter(bothValid)
    .map((i) => ({ ...i, s: timeToMinutes(i.start), e: timeToMinutes(i.end) }))
    .sort((a, b) => a.weekday - b.weekday || a.s - b.s);
  for (let k = 1; k < sorted.length; k++) {
    const prev = sorted[k - 1];
    const curr = sorted[k];
    // Touching intervals (09:00-13:00 and 13:00-17:00) are fine.
    if (curr.weekday === prev.weekday && curr.s < prev.e) {
      return {
        weekday: curr.weekday,
        a: `${prev.start}-${prev.end}`,
        b: `${curr.start}-${curr.end}`,
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------
//  Time off
// ---------------------------------------------------------------------

const instant = z.iso.datetime({ offset: true });
const MAX_TIME_OFF_MS = 366 * 24 * 60 * 60 * 1000;

export const createTimeOffSchema = z
  .strictObject({
    startsAt: instant.meta({ example: '2026-12-24T00:00:00-03:00' }),
    endsAt: instant.meta({ example: '2026-12-26T00:00:00-03:00' }),
    reason: z.string().trim().max(200).optional().meta({ example: 'Holidays' }),
  })
  .refine((t) => new Date(t.endsAt) > new Date(t.startsAt), {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  })
  .refine(
    (t) =>
      new Date(t.endsAt).getTime() - new Date(t.startsAt).getTime() <=
      MAX_TIME_OFF_MS,
    {
      message: 'Time off can last at most one year',
      path: ['endsAt'],
    },
  );
export type CreateTimeOffDto = z.infer<typeof createTimeOffSchema>;
