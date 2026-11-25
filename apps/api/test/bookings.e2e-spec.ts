import { ConflictException, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { BookingsService } from '../src/bookings/bookings.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  as,
  createOwnerWithBusiness,
  createTestApp,
  registerUser,
  resetDatabase,
} from './utils.js';

/**
 * The business is in Buenos Aires (UTC-3). 2099-01-05 is a Monday; staff work
 * 09:00-12:00 local, i.e. 12:00-15:00 UTC.
 */
const MONDAY = '2099-01-05';
const at = (localTime: string) => `${MONDAY}T${localTime}:00-03:00`;

describe('Bookings', () => {
  let app: INestApplication;
  let owner: ReturnType<typeof as>;
  let customer: ReturnType<typeof as>;
  let customerId: string;
  let businessId: string;
  let slug: string;
  let serviceId: string;
  let martinId: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    const setup = await createOwnerWithBusiness(app);
    owner = as(app, setup.owner.accessToken);
    businessId = setup.business.id;
    slug = setup.business.slug;

    serviceId = await createService({ durationMin: 60, bufferMin: 0 });
    martinId = await createStaff('Martín');

    const registered = await registerUser(app);
    customer = as(app, registered.accessToken);
    customerId = (await customer.get('/me')).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function createService(body: Record<string, unknown>) {
    const res = await owner
      .post(`/businesses/${businessId}/services`)
      .send({ name: 'Haircut', priceCents: 1_500_000, ...body })
      .expect(201);
    return res.body.id as string;
  }

  async function createStaff(name: string, services = [serviceId]) {
    const res = await owner
      .post(`/businesses/${businessId}/staff`)
      .send({ name, serviceIds: services })
      .expect(201);
    await owner
      .put(`/businesses/${businessId}/staff/${res.body.id}/working-hours`)
      .send([{ weekday: 1, start: '09:00', end: '12:00' }])
      .expect(200);
    return res.body.id as string;
  }

  const book = (client: ReturnType<typeof as>, body: Record<string, unknown>) =>
    client.post('/bookings').send({ businessSlug: slug, serviceId, ...body });

  async function freeTimes(service = serviceId) {
    const res = await request(app.getHttpServer())
      .get(`/public/businesses/${slug}/availability`)
      .query({ serviceId: service, from: MONDAY })
      .expect(200);
    return res.body.slots.map((s: { localTime: string }) => s.localTime);
  }

  describe('POST /bookings', () => {
    it('books a free slot and takes it out of the availability', async () => {
      const res = await book(customer, { startsAt: at('09:00') }).expect(201);

      expect(res.body).toMatchObject({
        status: 'CONFIRMED',
        startsAt: '2099-01-05T12:00:00.000Z',
        endsAt: '2099-01-05T13:00:00.000Z',
        localDate: MONDAY,
        localTime: '09:00',
        service: { id: serviceId, name: 'Haircut', priceCents: 1_500_000 },
        staff: { id: martinId, name: 'Martín' },
        customer: { id: customerId },
      });
      // 60-minute slots that would overlap 09:00-10:00 are gone.
      expect(await freeTimes()).toEqual([
        '10:00',
        '10:15',
        '10:30',
        '10:45',
        '11:00',
      ]);
    });

    it('keeps the price it was booked at when the catalog changes', async () => {
      const { body } = await book(customer, { startsAt: at('09:00') }).expect(
        201,
      );

      await owner
        .patch(`/businesses/${businessId}/services/${serviceId}`)
        .send({ name: 'Premium haircut', priceCents: 9_999_999 })
        .expect(200);

      const res = await customer.get(`/bookings/${body.id}`).expect(200);
      expect(res.body.service).toMatchObject({
        name: 'Haircut',
        priceCents: 1_500_000,
      });
    });

    it('rejects a slot that is already booked', async () => {
      await book(customer, { startsAt: at('09:00') }).expect(201);
      await book(customer, { startsAt: at('09:30') }).expect(409);
    });

    it.each([
      ['not aligned to a slot', at('09:07')],
      ['outside working hours', at('13:00')],
      ['too late to fit before closing', at('11:15')],
      ['in the past', '2000-01-03T09:00:00-03:00'],
    ])('returns 409 for a time %s', async (_case, startsAt) => {
      const res = await book(customer, { startsAt }).expect(409);
      expect(res.body.message).toBe('That time is not available');
    });

    it('respects the service buffer', async () => {
      const withBuffer = await createService({
        durationMin: 30,
        bufferMin: 15,
      });
      await owner
        .patch(`/businesses/${businessId}/staff/${martinId}`)
        .send({ serviceIds: [serviceId, withBuffer] })
        .expect(200);

      await book(customer, {
        serviceId: withBuffer,
        startsAt: at('09:00'),
      }).expect(201);

      // Busy 09:00-09:45 (30 min + 15 buffer): 09:30 is taken, 09:45 is free.
      const times = await freeTimes(withBuffer);
      expect(times).not.toContain('09:30');
      expect(times[0]).toBe('09:45');
    });

    it('allows back-to-back bookings', async () => {
      await book(customer, { startsAt: at('09:00') }).expect(201);
      await book(customer, { startsAt: at('10:00') }).expect(201);
    });

    it('assigns any free staff member when none is chosen', async () => {
      const luciaId = await createStaff('Lucía');

      const first = await book(customer, { startsAt: at('09:00') }).expect(201);
      const second = await book(customer, { startsAt: at('09:00') }).expect(
        201,
      );
      await book(customer, { startsAt: at('09:00') }).expect(409);

      expect([first.body.staff.id, second.body.staff.id].sort()).toEqual(
        [martinId, luciaId].sort(),
      );
    });

    it('books the chosen staff member, or 409 if that person is busy', async () => {
      const luciaId = await createStaff('Lucía');
      await book(customer, { staffId: luciaId, startsAt: at('09:00') }).expect(
        201,
      );

      await book(customer, { staffId: luciaId, startsAt: at('09:00') }).expect(
        409,
      );
      const other = await book(customer, { startsAt: at('09:00') }).expect(201);
      expect(other.body.staff.id).toBe(martinId);
    });

    it('returns 404 for an unknown business or an archived service', async () => {
      await book(customer, {
        businessSlug: 'nope-nope',
        startsAt: at('09:00'),
      }).expect(404);
      await owner
        .delete(`/businesses/${businessId}/services/${serviceId}`)
        .expect(204);
      await book(customer, { startsAt: at('09:00') }).expect(404);
    });

    it.each([
      ['a time without offset', { startsAt: '2099-01-05T09:00:00' }],
      ['an unknown field', { startsAt: at('09:00'), priceCents: 1 }],
    ])('returns 400 for %s', async (_case, body) => {
      await book(customer, body).expect(400);
    });

    it('requires authentication', async () => {
      await request(app.getHttpServer())
        .post('/bookings')
        .send({ businessSlug: slug, serviceId, startsAt: at('09:00') })
        .expect(401);
    });
  });

  describe('no double booking under concurrency', () => {
    it('lets exactly one of 10 simultaneous requests book the same slot', async () => {
      const bookings = app.get(BookingsService);
      const prisma = app.get(PrismaService);

      // Open several pooled connections first. With a single connection the
      // requests would run one after another and the race would never happen.
      await Promise.all(
        Array.from(
          { length: 10 },
          () => prisma.$queryRaw`SELECT 1 FROM pg_sleep(0.05)`,
        ),
      );

      // Called on the service so the requests really overlap (over HTTP they
      // tend to arrive one after another). They all pass the availability
      // check before any of them inserts; only the database can stop them.
      const results = await Promise.allSettled(
        Array.from({ length: 10 }, () =>
          bookings.create(customerId, {
            businessSlug: slug,
            serviceId,
            staffId: martinId,
            startsAt: at('09:00'),
          }),
        ),
      );

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      );
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(9);
      expect(rejected.every((r) => r.reason instanceof ConflictException)).toBe(
        true,
      );
      expect(await app.get(PrismaService).booking.count()).toBe(1);
    });

    it('is enforced by the database itself, not only by the API', async () => {
      const prisma = app.get(PrismaService);
      const base = {
        businessId,
        serviceId,
        staffId: martinId,
        customerId,
        serviceName: 'Haircut',
        durationMin: 60,
        priceCents: 1,
      };
      const first = await prisma.booking.create({
        data: {
          ...base,
          startsAt: new Date('2099-01-05T12:00:00Z'),
          endsAt: new Date('2099-01-05T13:00:00Z'),
          blockedUntil: new Date('2099-01-05T13:00:00Z'),
        },
      });
      const overlapping = {
        ...base,
        startsAt: new Date('2099-01-05T12:30:00Z'),
        endsAt: new Date('2099-01-05T13:30:00Z'),
        blockedUntil: new Date('2099-01-05T13:30:00Z'),
      };

      await expect(
        prisma.booking.create({ data: overlapping }),
      ).rejects.toThrow(/bookings_no_overlap/);

      // Cancelled bookings don't block: the constraint only covers CONFIRMED ones.
      await prisma.booking.update({
        where: { id: first.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
      await expect(
        prisma.booking.create({ data: overlapping }),
      ).resolves.toBeDefined();
    });
  });

  describe('cancel', () => {
    it('cancels and frees the slot; cancelling again is a no-op', async () => {
      const { body } = await book(customer, { startsAt: at('09:00') }).expect(
        201,
      );

      const res = await customer
        .post(`/bookings/${body.id}/cancel`)
        .expect(200);
      expect(res.body.status).toBe('CANCELLED');
      expect(res.body.cancelledAt).toEqual(expect.any(String));
      expect(await freeTimes()).toContain('09:00');

      await customer.post(`/bookings/${body.id}/cancel`).expect(200);
    });

    it('lets the business cancel, but hides the booking from other users', async () => {
      const { body } = await book(customer, { startsAt: at('09:00') }).expect(
        201,
      );
      const stranger = as(app, (await registerUser(app)).accessToken);

      await stranger.get(`/bookings/${body.id}`).expect(404);
      await stranger.post(`/bookings/${body.id}/cancel`).expect(404);

      await owner.get(`/bookings/${body.id}`).expect(200);
      await owner.post(`/bookings/${body.id}/cancel`).expect(200);
    });

    it('rejects cancelling a booking that already started', async () => {
      const { body } = await book(customer, { startsAt: at('09:00') }).expect(
        201,
      );
      await app.get(PrismaService).booking.update({
        where: { id: body.id },
        data: {
          startsAt: new Date('2000-01-01T12:00:00Z'),
          endsAt: new Date('2000-01-01T13:00:00Z'),
          blockedUntil: new Date('2000-01-01T13:00:00Z'),
        },
      });

      await customer.post(`/bookings/${body.id}/cancel`).expect(409);
    });
  });

  describe('reschedule', () => {
    it('moves the booking to another free time', async () => {
      const { body } = await book(customer, { startsAt: at('09:00') }).expect(
        201,
      );

      const res = await customer
        .post(`/bookings/${body.id}/reschedule`)
        .send({ startsAt: at('11:00') })
        .expect(200);

      expect(res.body).toMatchObject({ id: body.id, localTime: '11:00' });
      expect(await freeTimes()).toContain('09:00');
    });

    it('can move into a time that overlaps its own current time', async () => {
      const { body } = await book(customer, { startsAt: at('09:00') }).expect(
        201,
      );

      await customer
        .post(`/bookings/${body.id}/reschedule`)
        .send({ startsAt: at('09:30') })
        .expect(200);
    });

    it('keeps the booking unchanged when the new time is taken', async () => {
      const { body } = await book(customer, { startsAt: at('09:00') }).expect(
        201,
      );
      await book(customer, { startsAt: at('10:00') }).expect(201);

      await customer
        .post(`/bookings/${body.id}/reschedule`)
        .send({ startsAt: at('10:00') })
        .expect(409);

      const res = await customer.get(`/bookings/${body.id}`).expect(200);
      expect(res.body.localTime).toBe('09:00');
    });

    it('rejects rescheduling a cancelled booking', async () => {
      const { body } = await book(customer, { startsAt: at('09:00') }).expect(
        201,
      );
      await customer.post(`/bookings/${body.id}/cancel`).expect(200);

      await customer
        .post(`/bookings/${body.id}/reschedule`)
        .send({ startsAt: at('10:00') })
        .expect(409);
    });
  });

  describe('listings', () => {
    it('shows customers only their own bookings', async () => {
      await book(customer, { startsAt: at('09:00') }).expect(201);
      const other = as(app, (await registerUser(app)).accessToken);
      await book(other, { startsAt: at('10:00') }).expect(201);

      const mine = await customer
        .get('/me/bookings?scope=upcoming')
        .expect(200);
      expect(mine.body.map((b: { localTime: string }) => b.localTime)).toEqual([
        '09:00',
      ]);
      expect(
        (await customer.get('/me/bookings?scope=past').expect(200)).body,
      ).toEqual([]);
    });

    it('shows the business agenda for a date range, to members only', async () => {
      await book(customer, { startsAt: at('10:00') }).expect(201);
      await book(customer, { startsAt: at('09:00') }).expect(201);

      const agenda = await owner
        .get(`/businesses/${businessId}/bookings?from=${MONDAY}&to=${MONDAY}`)
        .expect(200);
      expect(
        agenda.body.map((b: { localTime: string }) => b.localTime),
      ).toEqual(['09:00', '10:00']);
      expect(agenda.body[0].customer).toMatchObject({ id: customerId });

      const nextDay = '2099-01-06';
      const empty = await owner
        .get(`/businesses/${businessId}/bookings?from=${nextDay}&to=${nextDay}`)
        .expect(200);
      expect(empty.body).toEqual([]);

      await customer
        .get(`/businesses/${businessId}/bookings?from=${MONDAY}&to=${MONDAY}`)
        .expect(404);
    });
  });
});
