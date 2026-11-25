import { DateTime } from 'luxon';
import { z } from 'zod';
import { slugSchema } from '../common/slug.js';

const instant = z.iso
  .datetime({ offset: true })
  .meta({ example: '2026-12-07T09:00:00-03:00' });

export const createBookingSchema = z.strictObject({
  businessSlug: slugSchema,
  serviceId: z.uuid(),
  /** Optional: without it, the first staff member free at that time is assigned. */
  staffId: z.uuid().optional(),
  /** Must match a slot returned by the availability endpoint. */
  startsAt: instant,
  notes: z.string().trim().max(500).optional().meta({ example: 'First visit' }),
});
export type CreateBookingDto = z.infer<typeof createBookingSchema>;

export const rescheduleBookingSchema = z.strictObject({
  startsAt: instant,
  /** Optional: keep the current staff member, or move to another one. */
  staffId: z.uuid().optional(),
});
export type RescheduleBookingDto = z.infer<typeof rescheduleBookingSchema>;

export const myBookingsQuerySchema = z.strictObject({
  scope: z.enum(['upcoming', 'past']).optional(),
});

const localDate = z.iso.date().meta({ example: '2026-12-07' });

export const businessBookingsQuerySchema = z
  .strictObject({
    /** Local dates (business time zone), inclusive. */
    from: localDate,
    to: localDate,
    staffId: z.uuid().optional(),
    status: z.enum(['CONFIRMED', 'CANCELLED']).optional(),
  })
  .refine((q) => q.to >= q.from, {
    message: 'to must not be before from',
    path: ['to'],
  })
  .refine((q) => daysBetween(q.from, q.to) < 62, {
    message: 'The range can cover at most 62 days',
    path: ['to'],
  });
export type BusinessBookingsQuery = z.infer<typeof businessBookingsQuerySchema>;

function daysBetween(from: string, to: string) {
  return DateTime.fromISO(to).diff(DateTime.fromISO(from), 'days').days;
}
