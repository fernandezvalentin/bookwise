import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Alert, Container, PageTitle } from '@/components/ui';
import { api } from '@/lib/api';
import { bookingHref, getPublicBusiness } from '@/lib/business';
import {
  formatDay,
  formatDuration,
  formatPrice,
  timezoneLabel,
  upcomingDays,
} from '@/lib/format';
import { getCurrentUser } from '@/lib/session';
import type { Availability, Booking } from '@/lib/types';

export const metadata: Metadata = { title: 'Pick a time' };

const DAYS_SHOWN = 14;

/**
 * Step 1 of booking: pick a staff member (or anyone), a day and a time. Every
 * choice is a link that updates the URL, so this page needs no client-side
 * JavaScript, and any step can be shared or reloaded.
 */
export default async function BookPage({
  params,
  searchParams,
}: PageProps<'/b/[slug]/book'>) {
  const { slug } = await params;
  const query = await searchParams;
  const business = await getPublicBusiness(slug);

  const service = business.services.find((s) => s.id === query.service);
  if (!service) redirect(`/b/${slug}`);

  const rescheduling =
    typeof query.reschedule === 'string'
      ? await loadBooking(query.reschedule)
      : null;
  const providers = business.staff.filter((s) =>
    s.serviceIds.includes(service.id),
  );
  const days = upcomingDays(business.timezone, DAYS_SHOWN);

  // When moving a booking, keep its staff member unless another one is picked.
  const defaultStaff = rescheduling?.staff.id ?? 'any';
  const staff =
    typeof query.staff === 'string' &&
    (query.staff === 'any' || providers.some((p) => p.id === query.staff))
      ? query.staff
      : defaultStaff;
  const date =
    typeof query.date === 'string' && days.includes(query.date)
      ? query.date
      : days[0];

  const availability = await api<Availability>(
    `/public/businesses/${encodeURIComponent(slug)}/availability`,
    {
      query: {
        serviceId: service.id,
        staffId: staff === 'any' ? undefined : staff,
        from: date,
        to: date,
      },
    },
  );

  const step = {
    service: service.id,
    staff,
    date,
    reschedule: rescheduling?.id,
  };
  const staffOptions = [
    // "Anyone" only when booking: a reschedule keeps a concrete staff member.
    ...(rescheduling ? [] : [{ id: 'any', name: 'Anyone available' }]),
    ...providers,
  ];

  return (
    <Container>
      <PageTitle
        title={rescheduling ? `Reschedule: ${service.name}` : service.name}
        subtitle={`${business.name} · ${formatDuration(service.durationMin)} · ${formatPrice(service.priceCents)}`}
        back={{ href: `/b/${slug}`, label: 'All services' }}
      />

      {rescheduling && (
        <div className="mb-6">
          <Alert>
            Currently booked for {formatDay(rescheduling.localDate)} at{' '}
            {rescheduling.localTime}. Pick a new time.
          </Alert>
        </div>
      )}

      <section aria-labelledby="staff-heading" className="mb-6">
        <h2
          id="staff-heading"
          className="mb-2 text-sm font-medium text-zinc-700"
        >
          With
        </h2>
        <div className="flex flex-wrap gap-2">
          {staffOptions.map((option) => (
            <ChoiceLink
              key={option.id}
              href={bookingHref(slug, 'book', { ...step, staff: option.id })}
              selected={option.id === staff}
            >
              {option.name}
            </ChoiceLink>
          ))}
        </div>
      </section>

      <section aria-labelledby="day-heading" className="mb-6">
        <h2 id="day-heading" className="mb-2 text-sm font-medium text-zinc-700">
          Day{' '}
          <span className="font-normal text-zinc-500">
            ({timezoneLabel(business.timezone)})
          </span>
        </h2>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {days.map((day) => (
            <ChoiceLink
              key={day}
              href={bookingHref(slug, 'book', { ...step, date: day })}
              selected={day === date}
              className="shrink-0"
            >
              {formatDay(day)}
            </ChoiceLink>
          ))}
        </div>
      </section>

      <section aria-labelledby="time-heading">
        <h2
          id="time-heading"
          className="mb-2 text-sm font-medium text-zinc-700"
        >
          Time
        </h2>
        {availability.slots.length === 0 ? (
          <p className="card p-6 text-sm text-zinc-600">
            No free times on {formatDay(date)}. Try another day
            {staff !== 'any' && !rescheduling ? ' or anyone available' : ''}.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {availability.slots.map((slot) => (
              <Link
                key={slot.start}
                href={bookingHref(slug, 'confirm', {
                  ...step,
                  start: slot.start,
                })}
                className="btn-secondary tabular-nums"
              >
                {slot.localTime}
              </Link>
            ))}
          </div>
        )}
      </section>
    </Container>
  );
}

function ChoiceLink({
  href,
  selected,
  className = '',
  children,
}: {
  href: string;
  selected: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={selected ? 'true' : undefined}
      className={`rounded-full border px-3 py-1.5 text-sm transition ${
        selected
          ? 'border-brand bg-brand-soft font-medium text-brand'
          : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100'
      } ${className}`}
    >
      {children}
    </Link>
  );
}

/** The booking being rescheduled (must belong to the signed-in user). */
async function loadBooking(id: string): Promise<Booking | null> {
  if (!(await getCurrentUser())) return null;
  try {
    const booking = await api<Booking>(`/bookings/${encodeURIComponent(id)}`, {
      auth: true,
    });
    return booking.status === 'CONFIRMED' ? booking : null;
  } catch {
    notFound();
  }
}
