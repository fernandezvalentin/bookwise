import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionForm } from '@/components/action-form';
import { api } from '@/lib/api';
import {
  agendaDays,
  formatRange,
  hasNotStarted,
  isLocalDate,
  shiftDate,
  todayIn,
  type AgendaView,
} from '@/lib/dashboard';
import { getBusinessContext } from '@/lib/dashboard-server';
import {
  formatDay,
  formatLongDay,
  formatPrice,
  localParts,
  timezoneLabel,
} from '@/lib/format';
import type { Booking, StaffMember } from '@/lib/types';
import { cancelAgendaBooking } from '../actions';

export const metadata: Metadata = { title: 'Agenda' };

/**
 * The business agenda. Like the booking flow, every control is a link that
 * changes the URL (`?view=week&date=2026-12-07&staff=...`), so the page needs
 * no client state and any view can be reloaded or shared.
 */
export default async function AgendaPage({
  params,
  searchParams,
}: PageProps<'/dashboard/[businessId]'>) {
  const { businessId } = await params;
  const query = await searchParams;
  const business = await getBusinessContext(businessId);
  const tz = business.timezone;

  const today = todayIn(tz);
  const view: AgendaView = query.view === 'week' ? 'week' : 'day';
  const date = isLocalDate(query.date) ? query.date : today;
  const days = agendaDays(date, view);
  const from = days[0];
  const to = days.at(-1)!;

  const staff = await api<StaffMember[]>(`/businesses/${business.id}/staff`, {
    auth: true,
    query: { includeInactive: 'true' },
  });
  const staffId =
    typeof query.staff === 'string' && staff.some((s) => s.id === query.staff)
      ? query.staff
      : undefined;

  const bookings = await api<Booking[]>(`/businesses/${business.id}/bookings`, {
    auth: true,
    query: { from, to, staffId },
  });

  const confirmed = bookings.filter((b) => b.status === 'CONFIRMED');
  const revenue = confirmed.reduce((sum, b) => sum + b.service.priceCents, 0);

  const href = (changes: {
    view?: AgendaView;
    date?: string;
    staff?: string | null;
  }) => {
    const next = new URLSearchParams();
    next.set('view', changes.view ?? view);
    next.set('date', changes.date ?? date);
    const s = changes.staff === undefined ? staffId : changes.staff;
    if (s) next.set('staff', s);
    return `/dashboard/${business.id}?${next}`;
  };

  return (
    <div>
      {/* Toolbar: period navigation, day/week toggle, staff filter */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Link
            href={href({ date: shiftDate(date, view, -1) })}
            className="btn-secondary px-3"
            aria-label={`Previous ${view}`}
          >
            ‹
          </Link>
          <Link href={href({ date: today })} className="btn-secondary">
            Today
          </Link>
          <Link
            href={href({ date: shiftDate(date, view, 1) })}
            className="btn-secondary px-3"
            aria-label={`Next ${view}`}
          >
            ›
          </Link>
        </div>
        <h2 className="px-2 font-display text-xl font-medium">
          {view === 'day' ? formatLongDay(date) : formatRange(from, to)}
        </h2>
        <div className="ml-auto flex rounded-full border border-stone-200 bg-white p-1 text-sm">
          {(['day', 'week'] as const).map((v) => (
            <Link
              key={v}
              href={href({ view: v })}
              aria-current={v === view ? 'page' : undefined}
              className="rounded-full px-4 py-1.5 font-medium text-stone-600 capitalize aria-[current=page]:bg-brand aria-[current=page]:text-white"
            >
              {v}
            </Link>
          ))}
        </div>
      </div>

      {staff.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1 text-sm">
          {[{ id: null, name: 'Everyone' }, ...staff].map((s) => (
            <Link
              key={s.id ?? 'all'}
              href={href({ staff: s.id })}
              aria-current={
                (s.id ?? undefined) === staffId ? 'page' : undefined
              }
              className="rounded-full border border-stone-200 bg-white px-3 py-1 text-stone-600 hover:border-stone-300 aria-[current=page]:border-brand aria-[current=page]:bg-brand aria-[current=page]:text-white"
            >
              {s.name}
            </Link>
          ))}
        </div>
      )}

      <p className="mb-4 text-sm text-stone-500">
        {confirmed.length} {confirmed.length === 1 ? 'booking' : 'bookings'}
        {confirmed.length > 0 && <> · {formatPrice(revenue)} expected</>}
        {' · '}
        {timezoneLabel(tz)}
      </p>

      {view === 'day' ? (
        <DayView bookings={bookings} timezone={tz} />
      ) : (
        <WeekView
          days={days}
          today={today}
          bookings={bookings}
          dayHref={(d) => href({ view: 'day', date: d })}
        />
      )}
    </div>
  );
}

function DayView({
  bookings,
  timezone,
}: {
  bookings: Booking[];
  timezone: string;
}) {
  if (bookings.length === 0)
    return (
      <p className="card p-8 text-center text-sm text-stone-500">
        No bookings this day.
      </p>
    );

  return (
    <ul className="card divide-y divide-stone-100">
      {bookings.map((b) => {
        const cancelled = b.status === 'CANCELLED';
        const canCancel = !cancelled && hasNotStarted(b.startsAt);
        return (
          <li
            key={b.id}
            className={`flex flex-wrap items-start gap-x-4 gap-y-2 px-5 py-4 ${cancelled ? 'opacity-60' : ''}`}
          >
            <div className="w-28 shrink-0 text-sm tabular-nums">
              <p className="font-medium">
                {b.localTime}–{localParts(b.endsAt, timezone).localTime}
              </p>
              <p className="text-stone-500">{b.staff.name}</p>
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <p className={`font-medium ${cancelled ? 'line-through' : ''}`}>
                {b.service.name}{' '}
                <span className="font-normal text-stone-500">
                  · {formatPrice(b.service.priceCents)}
                </span>
              </p>
              <p className="truncate text-stone-600">
                {b.customer.name}{' '}
                <a
                  href={`mailto:${b.customer.email}`}
                  className="text-stone-500 hover:underline"
                >
                  {b.customer.email}
                </a>
              </p>
              {b.notes && (
                <p className="mt-1 text-stone-500 italic">“{b.notes}”</p>
              )}
            </div>
            {cancelled ? (
              <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-600">
                Cancelled
              </span>
            ) : (
              canCancel && (
                <ActionForm
                  action={cancelAgendaBooking.bind(null, b.id)}
                  submitLabel="Cancel"
                  pendingLabel="Cancelling…"
                  submitClassName="btn-danger px-3 py-1.5"
                  className="flex flex-col items-end gap-2"
                >
                  {null}
                </ActionForm>
              )
            )}
          </li>
        );
      })}
    </ul>
  );
}

function WeekView({
  days,
  today,
  bookings,
  dayHref,
}: {
  days: string[];
  today: string;
  bookings: Booking[];
  dayHref: (date: string) => string;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-7">
      {days.map((day) => {
        const dayBookings = bookings.filter((b) => b.localDate === day);
        return (
          <section
            key={day}
            className={`card min-h-28 p-2 ${day === today ? 'border-brand ring-1 ring-brand' : ''}`}
          >
            <Link
              href={dayHref(day)}
              className="mb-2 block rounded px-1 text-sm font-medium hover:bg-stone-100"
            >
              {formatDay(day)}
            </Link>
            {dayBookings.length === 0 ? (
              <p className="px-1 text-xs text-stone-400">—</p>
            ) : (
              <ul className="space-y-1">
                {dayBookings.map((b) => (
                  <li
                    key={b.id}
                    className={`rounded-md px-2 py-1 text-xs ${
                      b.status === 'CANCELLED'
                        ? 'bg-stone-100 text-stone-400 line-through'
                        : 'bg-brand-soft text-brand-dark'
                    }`}
                  >
                    <span className="font-semibold tabular-nums">
                      {b.localTime}
                    </span>{' '}
                    {b.service.name}
                    <span className="block truncate opacity-80">
                      {b.customer.name} · {b.staff.name}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
