import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';

/**
 * The public demo business, as plain data. Building it is a pure function of
 * "now", so it can be unit tested and the reset only has to write it.
 */

/** Fixed, so dashboard links (/dashboard/<id>) survive the nightly reset. */
export const DEMO_BUSINESS_ID = 'b0000000-0000-4000-8000-000000000001';
export const DEMO_SLUG = 'barberia-centro';
export const DEMO_TIMEZONE = 'America/Argentina/Buenos_Aires';

/**
 * Seeded customers use the reserved `.invalid` TLD (RFC 2606): those addresses
 * can never exist, and the mail service never sends to them.
 */
export const DEMO_CUSTOMER_DOMAIN = 'customers.invalid';

/** How many days of bookings are generated before and after today. */
const DAYS_BACK = 7;
const DAYS_AHEAD = 14;
/** Roughly how many of the possible start times get a booking. */
const OCCUPANCY = 0.4;
const STEP_MIN = 15;

interface DemoService {
  key: string;
  name: string;
  description: string;
  durationMin: number;
  bufferMin: number;
  priceCents: number;
}

const SERVICES: DemoService[] = [
  {
    key: 'haircut',
    name: 'Haircut',
    description: 'Classic or modern cut, washed and styled.',
    durationMin: 30,
    bufferMin: 0,
    priceCents: 1_500_000,
  },
  {
    key: 'haircut-beard',
    name: 'Haircut & beard',
    description: 'Full haircut plus beard trim and hot towel.',
    durationMin: 45,
    bufferMin: 5,
    priceCents: 2_200_000,
  },
  {
    key: 'beard',
    name: 'Beard trim',
    description: 'Shape-up with razor finish.',
    durationMin: 20,
    bufferMin: 0,
    priceCents: 900_000,
  },
  {
    key: 'color',
    name: 'Hair color',
    description: 'Full color or highlights. Includes a short consultation.',
    durationMin: 90,
    bufferMin: 15,
    priceCents: 4_500_000,
  },
];

/** Weekly hours as [weekday (1 = Monday), "HH:mm", "HH:mm"]. */
type Interval = [number, string, string];

const STAFF: { name: string; services: string[]; hours: Interval[] }[] = [
  {
    name: 'Martín',
    services: ['haircut', 'haircut-beard', 'beard'],
    hours: [
      ...[1, 2, 3, 4, 5].flatMap((d): Interval[] => [
        [d, '09:00', '13:00'],
        [d, '14:00', '19:00'],
      ]),
      [6, '09:00', '14:00'],
    ],
  },
  {
    name: 'Sofía',
    services: ['haircut', 'haircut-beard', 'beard', 'color'],
    hours: [2, 3, 4, 5, 6].map((d): Interval => [d, '10:00', '19:00']),
  },
  {
    name: 'Lucas',
    services: ['haircut', 'beard'],
    hours: [1, 2, 3, 4, 5].map((d): Interval => [d, '13:00', '21:00']),
  },
];

const CUSTOMERS = [
  'Lucía Gómez',
  'Mateo Fernández',
  'Valentina Ruiz',
  'Joaquín Díaz',
  'Camila Torres',
  'Tomás Romero',
];

const NOTES = [
  'First visit',
  'Short on the sides, please',
  'Running 5 minutes late maybe',
  null,
  null,
  null,
];

export interface DemoData {
  business: { id: string; name: string; slug: string; timezone: string };
  services: (Omit<DemoService, 'key'> & { id: string })[];
  staff: { id: string; name: string }[];
  staffServices: { staffId: string; serviceId: string }[];
  workingHours: {
    staffId: string;
    weekday: number;
    startMinute: number;
    endMinute: number;
  }[];
  customers: { id: string; name: string; email: string }[];
  bookings: {
    id: string;
    serviceId: string;
    staffId: string;
    customerId: string;
    startsAt: Date;
    endsAt: Date;
    blockedUntil: Date;
    status: 'CONFIRMED' | 'CANCELLED';
    serviceName: string;
    durationMin: number;
    priceCents: number;
    notes: string | null;
    cancelledAt: Date | null;
  }[];
}

/**
 * Builds the demo business with bookings around `now`. The pattern of
 * bookings is deterministic for a given day (seeded by date and staff), so
 * the demo looks the same after every reset that day.
 */
export function buildDemoData(now: Date, id: () => string = randomUUID) {
  const services = SERVICES.map(({ key, ...s }) => ({ key, id: id(), ...s }));
  const serviceByKey = new Map(services.map((s) => [s.key, s]));

  const staff = STAFF.map((s) => ({
    id: id(),
    name: s.name,
    services: s.services.map((key) => serviceByKey.get(key)!),
    hours: s.hours.map(([weekday, start, end]) => ({
      weekday,
      startMinute: toMinutes(start),
      endMinute: toMinutes(end),
    })),
  }));

  const customers = CUSTOMERS.map((name) => ({
    id: id(),
    name,
    email: `${slugify(name)}@${DEMO_CUSTOMER_DOMAIN}`,
  }));

  const today = DateTime.fromJSDate(now, { zone: DEMO_TIMEZONE }).startOf(
    'day',
  );
  const bookings: DemoData['bookings'] = [];

  for (let offset = -DAYS_BACK; offset <= DAYS_AHEAD; offset++) {
    const day = today.plus({ days: offset });
    const date = day.toISODate()!;

    for (const member of staff) {
      for (const interval of member.hours.filter(
        (h) => h.weekday === day.weekday,
      )) {
        let minute = interval.startMinute;
        while (minute < interval.endMinute) {
          const roll = random(`${date}|${member.name}|${minute}`);
          const service =
            member.services[Math.floor(roll * 1000) % member.services.length];
          const fits =
            minute + service.durationMin + service.bufferMin <=
            interval.endMinute;
          if (roll >= OCCUPANCY || !fits) {
            minute += STEP_MIN;
            continue;
          }

          const startsAt = day.set({
            hour: Math.floor(minute / 60),
            minute: minute % 60,
          });
          const endsAt = startsAt.plus({ minutes: service.durationMin });
          const customer =
            customers[Math.floor(roll * 10_000) % customers.length];
          // A few bookings are cancelled, like in any real agenda.
          const cancelled = Math.floor(roll * 100_000) % 12 === 0;
          bookings.push({
            id: id(),
            serviceId: service.id,
            staffId: member.id,
            customerId: customer.id,
            startsAt: startsAt.toJSDate(),
            endsAt: endsAt.toJSDate(),
            blockedUntil: endsAt
              .plus({ minutes: service.bufferMin })
              .toJSDate(),
            status: cancelled ? 'CANCELLED' : 'CONFIRMED',
            serviceName: service.name,
            durationMin: service.durationMin,
            priceCents: service.priceCents,
            notes: NOTES[Math.floor(roll * 1_000_000) % NOTES.length],
            cancelledAt: cancelled
              ? startsAt.minus({ days: 1 }).toJSDate()
              : null,
          });
          minute += service.durationMin + service.bufferMin;
          // Round up to the next step so starts stay on the grid.
          minute = Math.ceil(minute / STEP_MIN) * STEP_MIN;
        }
      }
    }
  }

  return {
    business: {
      id: DEMO_BUSINESS_ID,
      name: 'Barbería Centro',
      slug: DEMO_SLUG,
      timezone: DEMO_TIMEZONE,
    },
    services: services.map(({ key: _key, ...s }) => s),
    staff: staff.map(({ id, name }) => ({ id, name })),
    staffServices: staff.flatMap((m) =>
      m.services.map((s) => ({ staffId: m.id, serviceId: s.id })),
    ),
    workingHours: staff.flatMap((m) =>
      m.hours.map((h) => ({ staffId: m.id, ...h })),
    ),
    customers,
    bookings,
  } satisfies DemoData;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** "Lucía Gómez" -> "lucia.gomez" */
function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, '.');
}

/** Deterministic number in [0, 1) from a string (FNV-1a hash). */
function random(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 2 ** 32;
}
