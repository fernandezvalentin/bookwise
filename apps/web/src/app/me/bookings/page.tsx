import type { Metadata } from 'next';
import Link from 'next/link';
import { Container, PageTitle, StatusBadge } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDay } from '@/lib/format';
import { requireUser } from '@/lib/session';
import type { Booking } from '@/lib/types';

export const metadata: Metadata = { title: 'My bookings' };

export default async function MyBookingsPage() {
  await requireUser('/me/bookings');
  const [upcoming, past] = await Promise.all([
    api<Booking[]>('/me/bookings', {
      auth: true,
      query: { scope: 'upcoming' },
    }),
    api<Booking[]>('/me/bookings', { auth: true, query: { scope: 'past' } }),
  ]);

  return (
    <Container>
      <PageTitle title="My bookings" />
      <BookingList
        title="Upcoming"
        bookings={upcoming}
        empty="You have no upcoming bookings."
      />
      <BookingList title="Past" bookings={past} empty="No past bookings yet." />
    </Container>
  );
}

function BookingList({
  title,
  bookings,
  empty,
}: {
  title: string;
  bookings: Booking[];
  empty: string;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 text-sm font-medium text-zinc-700">{title}</h2>
      {bookings.length === 0 ? (
        <p className="card p-5 text-sm text-zinc-500">{empty}</p>
      ) : (
        <ul className="card divide-y divide-zinc-100">
          {bookings.map((b) => (
            <li key={b.id}>
              <Link
                href={`/bookings/${b.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-50"
              >
                <div className="w-24 shrink-0 text-sm">
                  <p className="font-medium">{formatDay(b.localDate)}</p>
                  <p className="text-zinc-500 tabular-nums">{b.localTime}</p>
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate font-medium">{b.service.name}</p>
                  <p className="truncate text-zinc-500">
                    {b.business.name} · {b.staff.name}
                  </p>
                </div>
                <StatusBadge status={b.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
