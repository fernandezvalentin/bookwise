import { DateTime } from 'luxon';
import { z } from 'zod';

export const MAX_RANGE_DAYS = 31;

const localDate = z.iso.date().meta({ example: '2026-12-07' });

export const availabilityQuerySchema = z
  .strictObject({
    serviceId: z.uuid(),
    /** Optional: only this staff member. Without it, anyone who provides the service. */
    staffId: z.uuid().optional(),
    /** First local day (in the business's time zone), YYYY-MM-DD. */
    from: localDate,
    /** Last local day, inclusive. Defaults to `from`. */
    to: localDate.optional(),
  })
  .transform((q) => ({ ...q, to: q.to ?? q.from }))
  .refine((q) => q.to >= q.from, {
    message: 'to must not be before from',
    path: ['to'],
  })
  .refine((q) => daysBetween(q.from, q.to) < MAX_RANGE_DAYS, {
    message: `The range can cover at most ${MAX_RANGE_DAYS} days`,
    path: ['to'],
  });
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

function daysBetween(from: string, to: string) {
  return DateTime.fromISO(to).diff(DateTime.fromISO(from), 'days').days;
}
