import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { DateTime } from 'luxon';
import { MailService } from '../src/mail/mail.service.js';
import {
  NOTIFICATIONS_QUEUE,
  reminderJobId,
} from '../src/notifications/notifications.constants.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { countEmailsAfterWait, waitForEmails } from './mailpit.js';
import {
  as,
  createOwnerWithBusiness,
  createTestApp,
  registerUser,
  resetDatabase,
} from './utils.js';

const HOUR_MS = 60 * 60 * 1000;
const MONDAY = '2099-01-05';
const at = (localTime: string) => `${MONDAY}T${localTime}:00-03:00`;

describe('Notifications (queue + email)', () => {
  let app: INestApplication;
  let queue: Queue;
  let prisma: PrismaService;
  let notifications: NotificationsService;
  let owner: ReturnType<typeof as>;
  let customer: ReturnType<typeof as>;
  let customerEmail: string;
  let businessId: string;
  let slug: string;
  let serviceId: string;
  let staffId: string;

  beforeAll(async () => {
    app = await createTestApp();
    queue = app.get<Queue>(getQueueToken(NOTIFICATIONS_QUEUE));
    prisma = app.get(PrismaService);
    notifications = app.get(NotificationsService);
  });

  beforeEach(async () => {
    await resetDatabase(app);
    await queue.obliterate({ force: true });

    const setup = await createOwnerWithBusiness(app);
    owner = as(app, setup.owner.accessToken);
    businessId = setup.business.id;
    slug = setup.business.slug;
    serviceId = (
      await owner
        .post(`/businesses/${businessId}/services`)
        .send({ name: 'Haircut', durationMin: 60, priceCents: 1000 })
        .expect(201)
    ).body.id;
    staffId = (
      await owner
        .post(`/businesses/${businessId}/staff`)
        .send({ name: 'Martín', serviceIds: [serviceId] })
        .expect(201)
    ).body.id;
    // Open every day, all day, so tests can also book in the next few hours.
    await owner
      .put(`/businesses/${businessId}/staff/${staffId}/working-hours`)
      .send(
        [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
          weekday,
          start: '00:00',
          end: '24:00',
        })),
      )
      .expect(200);

    // A unique address per test, so Mailpit searches only see this test's emails.
    customerEmail = `customer-${randomUUID()}@example.com`;
    customer = as(
      app,
      (await registerUser(app, { email: customerEmail })).accessToken,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  const book = (startsAt: string) =>
    customer
      .post('/bookings')
      .send({ businessSlug: slug, serviceId, startsAt })
      .expect(201)
      .then((res) => res.body as { id: string; startsAt: string });

  describe('when a booking is made, moved or cancelled', () => {
    it('sends a confirmation and schedules the reminder 24 hours before', async () => {
      const booking = await book(at('09:00'));

      await waitForEmails(customerEmail, 'Your booking is confirmed');

      const job = await queue.getJob(reminderJobId(booking.id));
      expect(await job!.getState()).toBe('delayed');
      expect(job!.data).toEqual({
        bookingId: booking.id,
        startsAt: booking.startsAt,
      });
      const sendAt = job!.timestamp + job!.opts.delay!;
      expect(sendAt).toBe(Date.parse(booking.startsAt) - 24 * HOUR_MS);
    });

    it('replaces the reminder when the booking is rescheduled', async () => {
      const booking = await book(at('09:00'));

      const moved = await customer
        .post(`/bookings/${booking.id}/reschedule`)
        .send({ startsAt: at('11:00') })
        .expect(200);

      await waitForEmails(customerEmail, 'Your booking was rescheduled');
      const job = await queue.getJob(reminderJobId(booking.id));
      expect(job!.data.startsAt).toBe(moved.body.startsAt);
      expect(job!.timestamp + job!.opts.delay!).toBe(
        Date.parse(moved.body.startsAt) - 24 * HOUR_MS,
      );
    });

    it('removes the reminder and sends a cancellation when cancelled', async () => {
      const booking = await book(at('09:00'));

      await customer.post(`/bookings/${booking.id}/cancel`).expect(200);

      await waitForEmails(customerEmail, 'Your booking was cancelled');
      expect(await queue.getJob(reminderJobId(booking.id))).toBeUndefined();
    });

    it('schedules no reminder for a booking made less than 24 hours ahead', async () => {
      const soon = await firstSlotWithin(23 * HOUR_MS);
      const booking = await book(soon);

      await waitForEmails(customerEmail, 'Your booking is confirmed');
      expect(await queue.getJob(reminderJobId(booking.id))).toBeUndefined();
    });

    it('still books when the queue is unavailable', async () => {
      vi.spyOn(queue, 'add').mockRejectedValue(new Error('Redis is down'));

      await book(at('09:00'));
    });
  });

  describe('sending the reminder', () => {
    it('sends it at most once, even if the job runs twice', async () => {
      const booking = await book(at('09:00'));
      const job = { bookingId: booking.id, startsAt: booking.startsAt };

      expect(await notifications.sendReminder(job)).toBe('sent');
      expect(await notifications.sendReminder(job)).toMatch(/^skipped/);

      await waitForEmails(customerEmail, 'Reminder');
      expect(await countEmailsAfterWait(customerEmail, 'Reminder', 1000)).toBe(
        1,
      );
      const saved = await prisma.booking.findUniqueOrThrow({
        where: { id: booking.id },
      });
      expect(saved.reminderSentAt).not.toBeNull();
    });

    it('skips a stale reminder: the booking was cancelled or moved', async () => {
      const cancelled = await book(at('09:00'));
      await customer.post(`/bookings/${cancelled.id}/cancel`).expect(200);
      const moved = await book(at('11:00'));

      expect(
        await notifications.sendReminder({
          bookingId: cancelled.id,
          startsAt: cancelled.startsAt,
        }),
      ).toMatch(/^skipped/);
      expect(
        await notifications.sendReminder({
          bookingId: moved.id,
          startsAt: '2099-01-05T15:00:00.000Z', // not its current start
        }),
      ).toMatch(/^skipped/);
      expect(await countEmailsAfterWait(customerEmail, 'Reminder')).toBe(0);
    });

    it('releases the claim when the email fails, so a retry can send it', async () => {
      const booking = await book(at('09:00'));
      const job = { bookingId: booking.id, startsAt: booking.startsAt };
      // Let the worker send the confirmation first, so the simulated failure
      // hits the reminder and not the confirmation.
      await waitForEmails(customerEmail, 'Your booking is confirmed');
      vi.spyOn(app.get(MailService), 'send').mockRejectedValueOnce(
        new Error('SMTP timeout'),
      );

      await expect(notifications.sendReminder(job)).rejects.toThrow(
        'SMTP timeout',
      );
      const afterFailure = await prisma.booking.findUniqueOrThrow({
        where: { id: booking.id },
      });
      expect(afterFailure.reminderSentAt).toBeNull();

      expect(await notifications.sendReminder(job)).toBe('sent');
    });
  });

  describe('the sweep (safety net)', () => {
    it('queues reminders that were never scheduled, and only those', async () => {
      const soon = DateTime.fromISO(await firstSlotWithin(3 * HOUR_MS));
      const lost = await book(soon.toISO()!);
      const recent = await book(soon.plus({ hours: 1 }).toISO()!);
      // Pretend `lost` was booked days ago (its reminder job got lost, e.g.
      // Redis was down) and has no job. `recent` was booked inside the
      // 24-hour window, so it intentionally gets no reminder.
      await queue.remove(reminderJobId(lost.id));
      await prisma.$executeRaw`
        UPDATE bookings SET updated_at = now() - interval '5 days' WHERE id = ${lost.id}::uuid`;

      expect(await notifications.sweepMissingReminders()).toBe(
        'queued 1 missing reminder(s)',
      );

      await waitForEmails(customerEmail, 'Reminder');
      expect(await countEmailsAfterWait(customerEmail, 'Reminder', 1000)).toBe(
        1,
      );
      const recentSaved = await prisma.booking.findUniqueOrThrow({
        where: { id: recent.id },
      });
      expect(recentSaved.reminderSentAt).toBeNull();
    });
  });

  /** Start (ISO) of the first free slot that begins within `withinMs` from now. */
  async function firstSlotWithin(withinMs: number): Promise<string> {
    const today = DateTime.now().setZone('America/Argentina/Buenos_Aires');
    const res = await customer
      .get(`/public/businesses/${slug}/availability`)
      .query({
        serviceId,
        from: today.toISODate()!,
        to: today.plus({ days: 1 }).toISODate()!,
      })
      .expect(200);
    const limit = Date.now() + withinMs;
    const slot = (res.body.slots as { start: string }[]).find(
      (s) =>
        Date.parse(s.start) > Date.now() + 30 * 60 * 1000 &&
        Date.parse(s.start) < limit,
    );
    if (!slot) throw new Error('No slot found in the next hours');
    return slot.start;
  }
});
