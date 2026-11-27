import Link from 'next/link';
import { Container } from '@/components/ui';
import { tryDemo } from './(auth)/actions';

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

/** Decorative preview of the booking flow (static markup, not interactive). */
const PREVIEW_TIMES = ['10:00', '10:30', '11:15', '14:00', '15:30', '17:45'];

export default function HomePage() {
  const demoSlug = process.env.DEMO_BUSINESS_SLUG;
  const demoDashboard = Boolean(
    process.env.DEMO_OWNER_EMAIL && process.env.DEMO_OWNER_PASSWORD,
  );

  return (
    <Container wide>
      <section className="grid items-center gap-12 py-6 sm:py-12 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <p className="eyebrow">For barbershops, clinics and studios</p>
          <h1 className="mt-4 font-display text-5xl leading-[1.05] font-medium tracking-tight text-balance sm:text-6xl">
            Online booking,{' '}
            <em className="font-normal text-brand">
              without the back-and-forth.
            </em>
          </h1>
          <p className="mt-5 max-w-lg text-lg text-stone-600">
            Customers pick a service, a staff member and a free time, and get an
            email reminder before their appointment. You get a tidy agenda.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {demoSlug && (
              <Link href={`/b/${demoSlug}`} className="btn-primary px-6 py-3">
                Try booking at the demo business
              </Link>
            )}
            {demoDashboard && (
              <form action={tryDemo}>
                <button className="btn-secondary px-6 py-3">
                  Try the business dashboard
                </button>
              </form>
            )}
          </div>
        </div>

        <div aria-hidden className="relative mx-auto w-full max-w-sm">
          <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-brand-soft" />
          <div className="absolute -top-3 -right-3 -z-10 size-24 rounded-full bg-accent-soft" />
          <div className="card rotate-1 p-6">
            <p className="eyebrow">Barbería Centro</p>
            <p className="mt-2 font-display text-2xl font-medium">Haircut</p>
            <p className="text-sm text-stone-500">30 min · with Sofía</p>
            <div className="mt-5 flex gap-2 text-sm">
              {['Thu 26', 'Fri 27', 'Sat 28'].map((day, i) => (
                <span
                  key={day}
                  className={`rounded-full border px-3 py-1 ${
                    i === 1
                      ? 'border-brand bg-brand text-white'
                      : 'border-stone-200 text-stone-600'
                  }`}
                >
                  {day}
                </span>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm tabular-nums">
              {PREVIEW_TIMES.map((time, i) => (
                <span
                  key={time}
                  className={`rounded-full border py-1.5 text-center ${
                    i === 3
                      ? 'border-accent bg-accent-soft font-medium text-accent'
                      : 'border-stone-200 text-stone-700'
                  }`}
                >
                  {time}
                </span>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-3 rounded-xl bg-cream p-3 text-sm">
              <span className="grid size-8 place-items-center rounded-full bg-brand text-white">
                ✓
              </span>
              <span>
                <span className="font-medium">Booked for 14:00</span>
                <span className="block text-xs text-stone-500">
                  Reminder sent the day before
                </span>
              </span>
            </div>
          </div>
        </div>
      </section>

      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(([title, text], i) => (
          <li key={title} className="card p-6">
            <span className="font-display text-3xl text-accent">0{i + 1}</span>
            <h2 className="mt-3 font-display text-lg font-medium">{title}</h2>
            <p className="mt-1.5 text-sm text-stone-600">{text}</p>
          </li>
        ))}
      </ul>
    </Container>
  );
}
