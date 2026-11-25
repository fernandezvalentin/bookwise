import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import type { Env } from '../config/env.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { bookingEmail } from './booking-emails.js';
import {
  JOB,
  NOTIFICATIONS_QUEUE,
  reminderJobId,
  SWEEP_EVERY_MS,
  type BookingEmailKind,
  type ReminderJob,
} from './notifications.constants.js';

const HOUR_MS = 60 * 60 * 1000;

interface BookingRef {
  id: string;
  startsAt: Date;
}

/**
 * Booking emails go through a queue instead of being sent inside the request:
 * the booking responds immediately, and a slow or failing SMTP server only
 * delays the email (the worker retries with exponential backoff).
 *
 * Enqueueing never fails the booking itself. If Redis is down, the error is
 * logged; reminders are recovered later by the periodic sweep.
 */
@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly reminderLeadMs: number;

  constructor(
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    config: ConfigService<Env, true>,
  ) {
    this.reminderLeadMs =
      config.get('REMINDER_HOURS_BEFORE', { infer: true }) * HOUR_MS;
  }

  /** Registers the periodic sweep (idempotent: one scheduler, however many restarts). */
  async onModuleInit() {
    await this.queue.upsertJobScheduler(
      JOB.sweepReminders,
      { every: SWEEP_EVERY_MS },
      { name: JOB.sweepReminders },
    );
  }

  // -------------------------------------------------------------------
  //  Called by the bookings service
  // -------------------------------------------------------------------

  async bookingConfirmed(booking: BookingRef) {
    await this.safely(async () => {
      await this.queue.add(JOB.bookingConfirmed, { bookingId: booking.id });
      await this.scheduleReminder(booking);
    });
  }

  async bookingRescheduled(booking: BookingRef) {
    await this.safely(async () => {
      await this.queue.add(JOB.bookingRescheduled, { bookingId: booking.id });
      await this.scheduleReminder(booking);
    });
  }

  async bookingCancelled(booking: BookingRef) {
    await this.safely(async () => {
      await this.queue.remove(reminderJobId(booking.id));
      await this.queue.add(JOB.bookingCancelled, { bookingId: booking.id });
    });
  }

  // -------------------------------------------------------------------
  //  Called by the worker
  // -------------------------------------------------------------------

  async sendBookingEmail(bookingId: string, kind: BookingEmailKind) {
    const booking = await this.loadForEmail(bookingId);
    if (!booking) return 'skipped: booking not found';
    await this.mail.send(bookingEmail(kind, booking));
    return 'sent';
  }

  /**
   * Sends the reminder at most once. The booking is "claimed" with a
   * conditional update before sending: it must still be confirmed, at the time
   * the reminder was scheduled for, and without a reminder sent. If the job
   * runs twice (retries, sweep), only the first claim succeeds.
   */
  async sendReminder(job: ReminderJob) {
    const claimed = await this.prisma.booking.updateMany({
      where: {
        id: job.bookingId,
        status: 'CONFIRMED',
        startsAt: new Date(job.startsAt),
        reminderSentAt: null,
      },
      data: { reminderSentAt: new Date() },
    });
    if (claimed.count === 0) return 'skipped: cancelled, moved or already sent';

    const booking = await this.loadForEmail(job.bookingId);
    try {
      await this.mail.send(bookingEmail('reminder', booking!));
    } catch (error) {
      // Release the claim so the retry can send it.
      await this.prisma.booking.update({
        where: { id: job.bookingId },
        data: { reminderSentAt: null },
      });
      throw error;
    }
    return 'sent';
  }

  /**
   * Safety net for reminders that were never queued (e.g. Redis was down when
   * the booking was made): confirmed bookings inside the reminder window,
   * without a reminder, that were booked or moved before the window opened.
   * Bookings made inside the window get no reminder: the confirmation is enough.
   */
  async sweepMissingReminders(now = new Date()) {
    const windowEnd = new Date(now.getTime() + this.reminderLeadMs);
    const candidates = await this.prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        reminderSentAt: null,
        startsAt: { gt: now, lte: windowEnd },
      },
      select: { id: true, startsAt: true, updatedAt: true },
      take: 500,
    });
    const missing = candidates.filter(
      (b) =>
        b.updatedAt.getTime() <= b.startsAt.getTime() - this.reminderLeadMs,
    );
    for (const booking of missing) {
      // Same job id as the scheduled reminder: if it's still queued, this is a no-op.
      await this.queue.add(
        JOB.bookingReminder,
        { bookingId: booking.id, startsAt: booking.startsAt.toISOString() },
        { jobId: reminderJobId(booking.id) },
      );
    }
    return `queued ${missing.length} missing reminder(s)`;
  }

  // -------------------------------------------------------------------

  /** One reminder job per booking, delayed until `REMINDER_HOURS_BEFORE` the start. */
  private async scheduleReminder(booking: BookingRef) {
    const jobId = reminderJobId(booking.id);
    await this.queue.remove(jobId);
    const delay = booking.startsAt.getTime() - this.reminderLeadMs - Date.now();
    if (delay <= 0) return; // booked inside the reminder window
    const data: ReminderJob = {
      bookingId: booking.id,
      startsAt: booking.startsAt.toISOString(),
    };
    await this.queue.add(JOB.bookingReminder, data, { jobId, delay });
  }

  private async safely(operation: () => Promise<void>) {
    try {
      await operation();
    } catch (error) {
      this.logger.error(`Could not enqueue notification: ${String(error)}`);
    }
  }

  private loadForEmail(bookingId: string) {
    return this.prisma.booking
      .findUnique({
        where: { id: bookingId },
        select: {
          startsAt: true,
          serviceName: true,
          customer: { select: { name: true, email: true } },
          business: { select: { name: true, timezone: true } },
          staff: { select: { name: true } },
        },
      })
      .then(
        (b) =>
          b && {
            customer: b.customer,
            business: b.business,
            serviceName: b.serviceName,
            staffName: b.staff.name,
            startsAt: b.startsAt,
          },
      );
  }
}
