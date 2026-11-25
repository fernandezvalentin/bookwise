'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { api, ApiError } from '@/lib/api';
import type { Booking } from '@/lib/types';

export interface ConfirmState {
  error?: string;
}

const confirmSchema = z.object({
  slug: z.string().min(1),
  service: z.uuid(),
  staff: z.union([z.literal('any'), z.uuid()]),
  start: z.iso.datetime(),
  notes: z.string().trim().max(500).optional(),
  reschedule: z.uuid().optional(),
});

/** Books the slot, or moves an existing booking to it. */
export async function confirmBooking(
  _prev: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  const parsed = confirmSchema.safeParse({
    ...Object.fromEntries(formData),
    reschedule: formData.get('reschedule') || undefined,
    notes: formData.get('notes') || undefined,
  });
  if (!parsed.success)
    return {
      error: 'Something is wrong with this booking. Please start again.',
    };
  const { slug, service, staff, start, notes, reschedule } = parsed.data;
  const staffId = staff === 'any' ? undefined : staff;

  let booking: Booking;
  try {
    booking = reschedule
      ? await api<Booking>(`/bookings/${reschedule}/reschedule`, {
          method: 'POST',
          auth: true,
          body: { startsAt: start, staffId },
        })
      : await api<Booking>('/bookings', {
          method: 'POST',
          auth: true,
          body: {
            businessSlug: slug,
            serviceId: service,
            staffId,
            startsAt: start,
            notes,
          },
        });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect(`/login?next=${encodeURIComponent(`/b/${slug}`)}`);
    }
    if (error instanceof ApiError && error.status === 409) {
      return {
        error:
          'Sorry, that time was just taken or is no longer available. Please pick another one.',
      };
    }
    return { error: 'We could not complete the booking. Please try again.' };
  }

  redirect(
    `/bookings/${booking.id}?done=${reschedule ? 'rescheduled' : 'booked'}`,
  );
}

export async function cancelBooking(formData: FormData) {
  const id = z.uuid().parse(formData.get('id'));
  try {
    await api(`/bookings/${id}/cancel`, { method: 'POST', auth: true });
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      redirect(`/bookings/${id}?done=too-late`);
    }
    throw error;
  }
  redirect(`/bookings/${id}?done=cancelled`);
}
