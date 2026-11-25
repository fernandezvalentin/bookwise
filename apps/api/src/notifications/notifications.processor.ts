import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import {
  JOB,
  NOTIFICATIONS_QUEUE,
  type BookingEmailJob,
  type ReminderJob,
} from './notifications.constants.js';
import { NotificationsService } from './notifications.service.js';

/**
 * The worker: takes jobs from the queue and delegates to NotificationsService.
 * A thrown error makes BullMQ retry the job (see the queue's default options).
 */
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  constructor(private readonly notifications: NotificationsService) {
    super();
  }

  async process(job: Job): Promise<string> {
    switch (job.name) {
      case JOB.bookingConfirmed:
        return this.notifications.sendBookingEmail(
          (job.data as BookingEmailJob).bookingId,
          'confirmed',
        );
      case JOB.bookingRescheduled:
        return this.notifications.sendBookingEmail(
          (job.data as BookingEmailJob).bookingId,
          'rescheduled',
        );
      case JOB.bookingCancelled:
        return this.notifications.sendBookingEmail(
          (job.data as BookingEmailJob).bookingId,
          'cancelled',
        );
      case JOB.bookingReminder:
        return this.notifications.sendReminder(job.data as ReminderJob);
      case JOB.sweepReminders:
        return this.notifications.sweepMissingReminders();
      default:
        throw new Error(`Unknown job: ${job.name}`);
    }
  }
}
