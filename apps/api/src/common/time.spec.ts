import {
  isTimeOfDay,
  isValidTimeZone,
  minutesToTime,
  timeToMinutes,
} from './time.js';

describe('time helpers', () => {
  it.each([
    ['00:00', 0],
    ['09:30', 570],
    ['23:59', 1439],
    ['24:00', 1440],
  ])('converts %s to %i minutes and back', (time, minutes) => {
    expect(timeToMinutes(time)).toBe(minutes);
    expect(minutesToTime(minutes)).toBe(time);
  });

  it.each(['9:30', '24:01', '25:00', '12:60', 'noon', ''])(
    'rejects "%s"',
    (value) => {
      expect(isTimeOfDay(value)).toBe(false);
      expect(() => timeToMinutes(value)).toThrow();
    },
  );

  it('rejects minutes outside a day', () => {
    expect(() => minutesToTime(-1)).toThrow();
    expect(() => minutesToTime(1441)).toThrow();
  });

  it('validates IANA time zones', () => {
    expect(isValidTimeZone('America/Argentina/Buenos_Aires')).toBe(true);
    expect(isValidTimeZone('Europe/Madrid')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus_Mons')).toBe(false);
  });
});
