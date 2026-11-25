export const NOTIFICATIONS_QUEUE = 'notifications';

export const JOB = {
  bookingConfirmed: 'booking-confirmed',
  bookingRescheduled: 'booking-rescheduled',
  bookingCancelled: 'booking-cancelled',
  bookingReminder: 'booking-reminder',
  sweepReminders: 'sweep-reminders',
} as const;

export type BookingEmailKind = 'confirmed' | 'rescheduled' | 'cancelled';

export interface BookingEmailJob {
  bookingId: string;
}

export interface ReminderJob {
  bookingId: string;
  /** The start the reminder was scheduled for. If the booking moved, it's stale. */
  startsAt: string;
}

/** One reminder job per booking: rescheduling replaces it, cancelling removes it. */
export const reminderJobId = (bookingId: string) => `reminder-${bookingId}`;

/** How often the sweep looks for bookings whose reminder was never queued. */
export const SWEEP_EVERY_MS = 10 * 60 * 1000;
