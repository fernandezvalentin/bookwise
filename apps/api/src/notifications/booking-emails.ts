import { DateTime } from 'luxon';
import type { MailMessage } from '../mail/mail.service.js';
import type { BookingEmailKind } from './notifications.constants.js';

export interface BookingEmailData {
  customer: { name: string; email: string };
  business: { name: string; timezone: string };
  serviceName: string;
  staffName: string;
  startsAt: Date;
}

const SUBJECTS: Record<BookingEmailKind | 'reminder', string> = {
  confirmed: 'Your booking is confirmed',
  rescheduled: 'Your booking was rescheduled',
  cancelled: 'Your booking was cancelled',
  reminder: 'Reminder: your appointment is coming up',
};

const INTROS: Record<BookingEmailKind | 'reminder', string> = {
  confirmed: 'your booking is confirmed:',
  rescheduled: 'your booking was moved to a new time:',
  cancelled: 'this booking was cancelled:',
  reminder: 'this is a reminder of your upcoming appointment:',
};

/**
 * Builds the email for a booking event. Times are shown in the business's
 * time zone, which is where the appointment physically happens.
 */
export function bookingEmail(
  kind: BookingEmailKind | 'reminder',
  data: BookingEmailData,
): MailMessage {
  const when = DateTime.fromJSDate(data.startsAt, {
    zone: data.business.timezone,
  }).toFormat("cccc, LLLL d, yyyy 'at' HH:mm");
  const subject = `${SUBJECTS[kind]} · ${data.business.name}`;
  const details = [
    ['Service', data.serviceName],
    ['With', data.staffName],
    ['When', `${when} (${data.business.timezone})`],
  ] as const;

  const text = [
    `Hi ${data.customer.name},`,
    '',
    `${capitalize(INTROS[kind])}`,
    '',
    ...details.map(([label, value]) => `${label}: ${value}`),
    '',
    `— ${data.business.name}`,
  ].join('\n');

  const html = `
    <p>Hi ${escape(data.customer.name)},</p>
    <p>${escape(capitalize(INTROS[kind]))}</p>
    <table>${details
      .map(
        ([label, value]) =>
          `<tr><td><strong>${label}</strong></td><td>${escape(value)}</td></tr>`,
      )
      .join('')}</table>
    <p>— ${escape(data.business.name)}</p>`;

  return { to: data.customer.email, subject, text, html };
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Names come from users: escape them before putting them in HTML. */
function escape(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
