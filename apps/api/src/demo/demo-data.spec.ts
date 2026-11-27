import { DateTime } from 'luxon';
import { isUndeliverable } from '../mail/mail.service.js';
import {
  buildDemoData,
  DEMO_BUSINESS_ID,
  DEMO_CUSTOMER_DOMAIN,
  DEMO_TIMEZONE,
} from './demo-data.js';

// A Thursday afternoon in Buenos Aires.
const now = new Date('2026-11-26T18:00:00-03:00');

/** Sequential ids, so two builds can be compared. */
function counter() {
  let n = 0;
  return () => `id-${++n}`;
}

describe('buildDemoData', () => {
  const data = buildDemoData(now, counter());

  it('always uses the same business id and slug', () => {
    expect(data.business).toMatchObject({
      id: DEMO_BUSINESS_ID,
      slug: 'barberia-centro',
    });
  });

  it('is deterministic for a given day', () => {
    const again = buildDemoData(
      new Date('2026-11-26T09:30:00-03:00'),
      counter(),
    );
    expect(again.bookings).toEqual(data.bookings);
  });

  it('books past and upcoming days, with some free time left', () => {
    const past = data.bookings.filter((b) => b.startsAt < now);
    const upcoming = data.bookings.filter((b) => b.startsAt > now);
    expect(past.length).toBeGreaterThan(10);
    expect(upcoming.length).toBeGreaterThan(10);
    expect(data.bookings.some((b) => b.status === 'CANCELLED')).toBe(true);
  });

  it('never overlaps confirmed bookings of the same staff member', () => {
    for (const staff of data.staff) {
      const own = data.bookings
        .filter((b) => b.staffId === staff.id && b.status === 'CONFIRMED')
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
      for (let i = 1; i < own.length; i++) {
        expect(own[i].startsAt.getTime()).toBeGreaterThanOrEqual(
          own[i - 1].blockedUntil.getTime(),
        );
      }
    }
  });

  it('books only inside working hours, with a service the staff provides', () => {
    for (const b of data.bookings) {
      const start = DateTime.fromJSDate(b.startsAt, { zone: DEMO_TIMEZONE });
      const end = DateTime.fromJSDate(b.blockedUntil, { zone: DEMO_TIMEZONE });
      const startMin = start.hour * 60 + start.minute;
      const endMin = startMin + end.diff(start, 'minutes').minutes;
      const inside = data.workingHours.some(
        (h) =>
          h.staffId === b.staffId &&
          h.weekday === start.weekday &&
          h.startMinute <= startMin &&
          endMin <= h.endMinute,
      );
      expect(inside).toBe(true);
      expect(data.staffServices).toContainEqual({
        staffId: b.staffId,
        serviceId: b.serviceId,
      });
    }
  });

  it('gives seeded customers addresses that are never emailed', () => {
    for (const c of data.customers) {
      expect(c.email.endsWith(`@${DEMO_CUSTOMER_DOMAIN}`)).toBe(true);
      expect(isUndeliverable(c.email)).toBe(true);
    }
  });
});

describe('isUndeliverable', () => {
  it('only matches the reserved .invalid TLD', () => {
    expect(isUndeliverable('ana@customers.invalid')).toBe(true);
    expect(isUndeliverable('ANA@X.INVALID')).toBe(true);
    expect(isUndeliverable('ana@example.com')).toBe(false);
    expect(isUndeliverable('ana@invalid.com')).toBe(false);
  });
});
