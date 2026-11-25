import Link from 'next/link';
import { Container } from '@/components/ui';

const FEATURES = [
  [
    'Real-time availability',
    'Free times are calculated from staff schedules, time off and existing bookings.',
  ],
  [
    'No double booking',
    'Guaranteed by the database, even when two people book the same slot at once.',
  ],
  [
    'Any time zone',
    'Times follow the business’s time zone, including daylight saving changes.',
  ],
  [
    'Email reminders',
    'Confirmation, changes and a reminder 24 hours before the appointment.',
  ],
];

export default function HomePage() {
  const demoSlug = process.env.DEMO_BUSINESS_SLUG;

  return (
    <Container>
      <section className="py-8 text-center sm:py-12">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Online booking for small businesses
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-zinc-600">
          Barbershops, clinics, studios: customers pick a service, a staff
          member and a free time, and get an email reminder before their
          appointment.
        </p>
        {demoSlug && (
          <Link href={`/b/${demoSlug}`} className="btn-primary mt-6">
            Try booking at the demo business
          </Link>
        )}
      </section>

      <ul className="grid gap-3 sm:grid-cols-2">
        {FEATURES.map(([title, text]) => (
          <li key={title} className="card p-5">
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-zinc-600">{text}</p>
          </li>
        ))}
      </ul>
    </Container>
  );
}
