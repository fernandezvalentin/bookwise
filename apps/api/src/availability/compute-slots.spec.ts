import {
  computeAvailableSlots,
  type ComputeSlotsInput,
  type StaffSchedule,
} from './compute-slots.js';

const BUENOS_AIRES = 'America/Argentina/Buenos_Aires'; // UTC-3, no daylight saving
const NEW_YORK = 'America/New_York'; // daylight saving: 2026-03-08 and 2026-11-01

/** 2026-12-07 is a Monday. */
const MONDAY = '2026-12-07';
const LONG_AGO = new Date('2000-01-01T00:00:00Z');

function staff(overrides: Partial<StaffSchedule> = {}): StaffSchedule {
  return {
    staffId: 'martin',
    workingHours: [{ weekday: 1, startMinute: 9 * 60, endMinute: 11 * 60 }],
    busy: [],
    ...overrides,
  };
}

function compute(overrides: Partial<ComputeSlotsInput> = {}) {
  return computeAvailableSlots({
    timezone: BUENOS_AIRES,
    staff: [staff()],
    durationMin: 30,
    bufferMin: 0,
    fromDate: MONDAY,
    toDate: MONDAY,
    earliestStart: LONG_AGO,
    ...overrides,
  });
}

const times = (slots: { localTime: string }[]) => slots.map((s) => s.localTime);

describe('computeAvailableSlots', () => {
  it('offers every 15 minutes, as long as the appointment ends by closing time', () => {
    expect(times(compute())).toEqual([
      '09:00',
      '09:15',
      '09:30',
      '09:45',
      '10:00',
      '10:15',
      '10:30',
    ]);
  });

  it('returns UTC instants and local labels', () => {
    const [first] = compute();
    expect(first).toEqual({
      start: '2026-12-07T12:00:00.000Z', // 09:00 in Buenos Aires (UTC-3)
      end: '2026-12-07T12:30:00.000Z',
      localDate: MONDAY,
      localTime: '09:00',
      staffIds: ['martin'],
    });
  });

  it('only uses the working hours of the matching weekday', () => {
    const tuesday = '2026-12-08';
    expect(compute({ fromDate: tuesday, toDate: tuesday })).toEqual([]);
  });

  it('supports split shifts', () => {
    const slots = compute({
      durationMin: 60,
      staff: [
        staff({
          workingHours: [
            { weekday: 1, startMinute: 9 * 60, endMinute: 10 * 60 },
            { weekday: 1, startMinute: 15 * 60, endMinute: 16 * 60 },
          ],
        }),
      ],
    });
    expect(times(slots)).toEqual(['09:00', '15:00']);
  });

  it('offers nothing when the appointment is longer than the shift', () => {
    expect(compute({ durationMin: 180 })).toEqual([]);
  });

  it('lets the buffer spill past closing time, but not into a busy period', () => {
    // Appointment 10:30-11:00 plus a 10 min buffer until 11:10, after closing: allowed.
    expect(times(compute({ bufferMin: 10 })).at(-1)).toBe('10:30');

    // A booking at 10:00 means a slot at 09:45 (+10 buffer = 10:25) collides with it.
    const busy = [
      {
        startsAt: new Date('2026-12-07T13:00:00Z'),
        endsAt: new Date('2026-12-07T13:30:00Z'),
      },
    ];
    const slots = compute({ bufferMin: 10, staff: [staff({ busy })] });
    expect(times(slots)).toEqual(['09:00', '09:15', '10:30']);
  });

  it('allows back-to-back appointments (busy periods are half-open)', () => {
    // Busy 09:30-10:00 local: 09:00-09:30 and 10:00-10:30 still fit.
    const busy = [
      {
        startsAt: new Date('2026-12-07T12:30:00Z'),
        endsAt: new Date('2026-12-07T13:00:00Z'),
      },
    ];
    expect(times(compute({ staff: [staff({ busy })] }))).toEqual([
      '09:00',
      '10:00',
      '10:15',
      '10:30',
    ]);
  });

  it('removes slots that overlap time off spanning several days', () => {
    const busy = [
      {
        startsAt: new Date('2026-12-06T00:00:00Z'),
        endsAt: new Date('2026-12-09T00:00:00Z'),
      },
    ];
    expect(compute({ staff: [staff({ busy })] })).toEqual([]);
  });

  it('skips slots that start before the earliest allowed instant', () => {
    const earliestStart = new Date('2026-12-07T13:05:00Z'); // 10:05 local
    expect(times(compute({ earliestStart }))).toEqual(['10:15', '10:30']);
  });

  it('merges staff free at the same time into one slot', () => {
    const slots = compute({
      durationMin: 60,
      staff: [
        staff({ staffId: 'martin' }),
        staff({
          staffId: 'lucia',
          workingHours: [
            { weekday: 1, startMinute: 10 * 60, endMinute: 12 * 60 },
          ],
        }),
      ],
    });
    const byTime = Object.fromEntries(
      slots.map((s) => [s.localTime, s.staffIds]),
    );
    expect(byTime['09:00']).toEqual(['martin']);
    expect(byTime['10:00']).toEqual(['martin', 'lucia']);
    expect(byTime['11:00']).toEqual(['lucia']);
  });

  it('accepts working hours that end at midnight (24:00)', () => {
    const slots = compute({
      durationMin: 60,
      staff: [
        staff({
          workingHours: [{ weekday: 1, startMinute: 22 * 60, endMinute: 1440 }],
        }),
      ],
    });
    expect(times(slots)).toEqual(['22:00', '22:15', '22:30', '22:45', '23:00']);
    // 23:00 local on Monday is already Tuesday in UTC: the local weekday is what counts.
    expect(slots.at(-1)!.start).toBe('2026-12-08T02:00:00.000Z');
  });

  it('covers every day of a multi-day range', () => {
    const slots = compute({
      durationMin: 120,
      fromDate: '2026-12-07',
      toDate: '2026-12-20', // two Mondays in range
    });
    expect(slots.map((s) => s.localDate)).toEqual(['2026-12-07', '2026-12-14']);
  });

  describe('daylight saving time', () => {
    it('keeps the local schedule when clocks change (same local time, different UTC)', () => {
      // 09:00 in New York: UTC-5 in winter (Monday 2026-03-02), UTC-4 in summer (Monday 2026-03-09).
      const schedule = staff({
        workingHours: [
          { weekday: 1, startMinute: 9 * 60, endMinute: 9 * 60 + 30 },
        ],
      });
      const slots = compute({
        timezone: NEW_YORK,
        staff: [schedule],
        fromDate: '2026-03-02',
        toDate: '2026-03-09',
      });

      expect(slots.map((s) => [s.localDate, s.localTime, s.start])).toEqual([
        ['2026-03-02', '09:00', '2026-03-02T14:00:00.000Z'],
        ['2026-03-09', '09:00', '2026-03-09T13:00:00.000Z'],
      ]);
    });

    it('offers no slots in the hour skipped by the spring-forward jump', () => {
      // Sunday 2026-03-08: at 02:00 clocks jump to 03:00. Open 01:00-04:00 local = 2 real hours.
      const slots = compute({
        timezone: NEW_YORK,
        durationMin: 60,
        stepMin: 60,
        staff: [
          staff({
            workingHours: [{ weekday: 7, startMinute: 60, endMinute: 240 }],
          }),
        ],
        fromDate: '2026-03-08',
        toDate: '2026-03-08',
      });

      expect(times(slots)).toEqual(['01:00', '03:00']);
    });

    it('offers the repeated hour twice on the fall-back day (it really happens twice)', () => {
      // Sunday 2026-11-01: at 02:00 clocks go back to 01:00. Open 00:00-03:00 local = 4 real hours.
      const slots = compute({
        timezone: NEW_YORK,
        durationMin: 60,
        stepMin: 60,
        staff: [
          staff({
            workingHours: [{ weekday: 7, startMinute: 0, endMinute: 180 }],
          }),
        ],
        fromDate: '2026-11-01',
        toDate: '2026-11-01',
      });

      expect(times(slots)).toEqual(['00:00', '01:00', '01:00', '02:00']);
      // Same label, different instants: one hour apart in UTC.
      expect(slots[1].start).toBe('2026-11-01T05:00:00.000Z');
      expect(slots[2].start).toBe('2026-11-01T06:00:00.000Z');
    });
  });
});
