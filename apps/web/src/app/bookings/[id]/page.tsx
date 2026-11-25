import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert, Container, PageTitle, StatusBadge } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { bookingHref } from '@/lib/business';
import {
  formatDuration,
  formatLongDay,
  formatPrice,
  timezoneLabel,
} from '@/lib/format';
import { requireUser } from '@/lib/session';
import type { Booking } from '@/lib/types';
import { cancelBooking } from '../actions';

export const metadata: Metadata = { title: 'Booking' };

const MESSAGES: Record<string, { tone: 'success' | 'error'; text: string }> = {
  booked: {
    tone: 'success',
    text: 'Your booking is confirmed. We sent you an email with the details.',
  },
  rescheduled: {
    tone: 'success',
    text: 'Your booking was moved to the new time.',
  },
  cancelled: { tone: 'success', text: 'Your booking was cancelled.' },
  'too-late': {
    tone: 'error',
    text: 'This booking already started, so it can no longer be cancelled.',
  },
};

export default async function BookingPage({
  params,
  searchParams,
}: PageProps<'/bookings/[id]'>) {
  const { id } = await params;
  const { done } = await searchParams;
  await requireUser(`/bookings/${id}`);

  let booking: Booking;
  try {
    booking = await api<Booking>(`/bookings/${encodeURIComponent(id)}`, {
      auth: true,
    });
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 404 || error.status === 400)
    )
      notFound();
    throw error;
  }

  const message = typeof done === 'string' ? MESSAGES[done] : undefined;
  const upcoming =
    booking.status === 'CONFIRMED' && isInTheFuture(booking.startsAt);

  return (
    <Container className="max-w-lg">
      <PageTitle
        title={booking.service.name}
        back={{ href: '/me/bookings', label: 'My bookings' }}
      />
      {message && (
        <div className="mb-6">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}
      <div className="card mb-6 divide-y divide-zinc-100 text-sm">
        <div className="flex items-center justify-between px-5 py-3">
          <span className="text-zinc-500">Status</span>
          <StatusBadge status={booking.status} />
        </div>
        <Row
          label="When"
          value={`${formatLongDay(booking.localDate)} at ${booking.localTime}`}
        />
        <Row
          label="Time zone"
          value={timezoneLabel(booking.business.timezone)}
        />
        <Row label="Where" value={booking.business.name} />
        <Row label="With" value={booking.staff.name} />
        <Row
          label="Service"
          value={`${formatDuration(booking.service.durationMin)} · ${formatPrice(booking.service.priceCents)}`}
        />
        {booking.notes && <Row label="Notes" value={booking.notes} />}
      </div>

      {upcoming && (
        <div className="flex flex-wrap gap-2">
          <Link
            href={bookingHref(booking.business.slug, 'book', {
              service: booking.service.id,
              reschedule: booking.id,
            })}
            className="btn-secondary"
          >
            Reschedule
          </Link>
          <form action={cancelBooking}>
            <input type="hidden" name="id" value={booking.id} />
            <button className="btn-danger">Cancel booking</button>
          </form>
        </div>
      )}
    </Container>
  );
}

/** Outside the component: reading the clock isn't allowed during render. */
function isInTheFuture(isoInstant: string) {
  return Date.parse(isoInstant) > Date.now();
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 px-5 py-3">
      <span className="w-24 shrink-0 text-zinc-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
