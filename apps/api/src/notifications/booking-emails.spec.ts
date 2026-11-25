import { bookingEmail, type BookingEmailData } from './booking-emails.js';

const data: BookingEmailData = {
  customer: { name: 'Ana', email: 'ana@example.com' },
  business: {
    name: 'Barbería Centro',
    timezone: 'America/Argentina/Buenos_Aires',
  },
  serviceName: 'Haircut',
  staffName: 'Martín',
  startsAt: new Date('2099-01-05T12:00:00Z'),
};

describe('bookingEmail', () => {
  it('shows the time in the business time zone', () => {
    const email = bookingEmail('confirmed', data);

    expect(email.to).toBe('ana@example.com');
    expect(email.subject).toBe('Your booking is confirmed · Barbería Centro');
    // 12:00 UTC is 09:00 in Buenos Aires.
    expect(email.text).toContain('When: Monday, January 5, 2099 at 09:00');
  });

  it.each([
    ['rescheduled', 'Your booking was rescheduled'],
    ['cancelled', 'Your booking was cancelled'],
    ['reminder', 'Reminder: your appointment is coming up'],
  ] as const)('has a subject for %s', (kind, subject) => {
    expect(bookingEmail(kind, data).subject).toContain(subject);
  });

  it('escapes user-provided names in the HTML version', () => {
    const email = bookingEmail('confirmed', {
      ...data,
      customer: { name: '<script>alert(1)</script>', email: 'x@example.com' },
    });

    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
  });
});
