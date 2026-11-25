import { describe, expect, it } from 'vitest';
import {
  formatDay,
  formatDuration,
  formatPrice,
  localParts,
  timezoneLabel,
  upcomingDays,
} from './format';

describe('format helpers', () => {
  it('formats prices stored in cents', () => {
    expect(formatPrice(1_500_000)).toBe('$15,000');
    expect(formatPrice(1_050)).toBe('$10.5');
  });

  it.each([
    [30, '30 min'],
    [60, '1 h'],
    [90, '1 h 30 min'],
  ])('formats %i minutes as "%s"', (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });

  it('formats a local date', () => {
    expect(formatDay('2026-11-30')).toBe('Mon, Nov 30');
  });

  it('converts an instant to the business local date and time', () => {
    // 02:30 UTC on Dec 1 is still Nov 30 in Buenos Aires (UTC-3).
    expect(
      localParts('2026-12-01T02:30:00.000Z', 'America/Argentina/Buenos_Aires'),
    ).toEqual({
      localDate: '2026-11-30',
      localTime: '23:30',
    });
  });

  it('lists consecutive days starting today', () => {
    const days = upcomingDays('UTC', 3);
    expect(days).toHaveLength(3);
    expect(Date.parse(days[2]) - Date.parse(days[0])).toBe(
      2 * 24 * 60 * 60 * 1000,
    );
  });

  it('names a time zone by its city', () => {
    expect(timezoneLabel('America/Argentina/Buenos_Aires')).toBe(
      'Buenos Aires time',
    );
  });
});
