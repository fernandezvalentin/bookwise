import { describe, expect, it } from 'vitest';
import {
  agendaDays,
  centsToInput,
  formatRange,
  isLocalDate,
  localInputToInstant,
  parsePriceToCents,
  shiftDate,
} from './dashboard';
import { describeDay, flattenWeek, groupByWeekday } from './schedule';

describe('agenda dates', () => {
  it('shows Monday to Sunday of the week of any day', () => {
    // 2026-12-10 is a Thursday.
    expect(agendaDays('2026-12-10', 'week')).toEqual([
      '2026-12-07',
      '2026-12-08',
      '2026-12-09',
      '2026-12-10',
      '2026-12-11',
      '2026-12-12',
      '2026-12-13',
    ]);
    expect(agendaDays('2026-12-13', 'week')[0]).toBe('2026-12-07'); // Sunday
    expect(agendaDays('2026-12-10', 'day')).toEqual(['2026-12-10']);
  });

  it('moves by day or week, across months and years', () => {
    expect(shiftDate('2026-12-31', 'day', 1)).toBe('2027-01-01');
    expect(shiftDate('2026-12-03', 'week', -1)).toBe('2026-11-26');
  });

  it('accepts only real calendar dates', () => {
    expect(isLocalDate('2026-12-07')).toBe(true);
    expect(isLocalDate('2026-02-30')).toBe(false);
    expect(isLocalDate('07/12/2026')).toBe(false);
    expect(isLocalDate(undefined)).toBe(false);
  });

  it('formats week ranges compactly', () => {
    expect(formatRange('2026-12-07', '2026-12-13')).toBe('Dec 7 – 13, 2026');
    expect(formatRange('2026-11-30', '2026-12-06')).toBe(
      'Nov 30 – Dec 6, 2026',
    );
    expect(formatRange('2026-12-28', '2027-01-03')).toBe(
      'Dec 28, 2026 – Jan 3, 2027',
    );
  });
});

describe('prices', () => {
  it('parses dollars typed in a form into cents', () => {
    expect(parsePriceToCents('15000')).toBe(1_500_000);
    expect(parsePriceToCents('15000.5')).toBe(1_500_050);
    expect(parsePriceToCents('0,99')).toBe(99);
    expect(parsePriceToCents('19.999')).toBeNull();
    expect(parsePriceToCents('-5')).toBeNull();
    expect(parsePriceToCents('')).toBeNull();
  });

  it('round-trips cents to the input value', () => {
    expect(centsToInput(1_500_000)).toBe('15000');
    expect(centsToInput(1_500_050)).toBe('15000.50');
  });
});

describe('time off inputs', () => {
  it('reads a datetime-local value in the business time zone', () => {
    expect(
      localInputToInstant('2026-12-24T09:00', 'America/Argentina/Buenos_Aires'),
    ).toBe('2026-12-24T09:00:00-03:00');
    // Madrid is UTC+1 in winter and UTC+2 in summer (DST).
    expect(localInputToInstant('2026-07-01T09:00', 'Europe/Madrid')).toBe(
      '2026-07-01T09:00:00+02:00',
    );
    expect(localInputToInstant('', 'Europe/Madrid')).toBeNull();
    expect(localInputToInstant('nope', 'Europe/Madrid')).toBeNull();
  });
});

describe('weekly schedule', () => {
  it('groups intervals by weekday and back', () => {
    const intervals = [
      { weekday: 1, start: '14:00', end: '18:00' },
      { weekday: 1, start: '09:00', end: '13:00' },
      { weekday: 6, start: '10:00', end: '14:00' },
    ];
    const days = groupByWeekday(intervals);
    expect(days).toHaveLength(7);
    expect(describeDay(days[0])).toBe('09:00–13:00, 14:00–18:00');
    expect(describeDay(days[1])).toBe('Closed');
    expect(flattenWeek(days)).toEqual([
      { weekday: 1, start: '09:00', end: '13:00' },
      { weekday: 1, start: '14:00', end: '18:00' },
      { weekday: 6, start: '10:00', end: '14:00' },
    ]);
  });
});
