import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  as,
  createOwnerWithBusiness,
  createTestApp,
  resetDatabase,
} from './utils.js';

describe('Services, staff and schedules', () => {
  let app: INestApplication;
  let api: ReturnType<typeof as>;
  let base: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    const { owner, business } = await createOwnerWithBusiness(app);
    api = as(app, owner.accessToken);
    base = `/businesses/${business.id}`;
  });

  afterAll(async () => {
    await app.close();
  });

  const createService = (body: Record<string, unknown> = {}) =>
    api.post(`${base}/services`).send({
      name: 'Haircut',
      durationMin: 30,
      priceCents: 1_500_000,
      ...body,
    });

  const createStaff = async (body: Record<string, unknown> = {}) =>
    (
      await api
        .post(`${base}/staff`)
        .send({ name: 'Martín', ...body })
        .expect(201)
    ).body as {
      id: string;
    };

  describe('services', () => {
    it('creates a service with a default buffer of 0', async () => {
      const res = await createService().expect(201);

      expect(res.body).toEqual({
        id: expect.any(String),
        name: 'Haircut',
        description: null,
        durationMin: 30,
        bufferMin: 0,
        priceCents: 1_500_000,
        active: true,
      });
    });

    it.each([
      ['a duration that is not a multiple of 5', { durationMin: 32 }],
      ['a duration over 8 hours', { durationMin: 485 }],
      ['a negative price', { priceCents: -1 }],
      ['a decimal price', { priceCents: 10.5 }],
    ])('returns 400 for %s', async (_case, body) => {
      await createService(body).expect(400);
    });

    it('archives instead of deleting, and can restore', async () => {
      const { body: service } = await createService().expect(201);

      await api.delete(`${base}/services/${service.id}`).expect(204);
      expect((await api.get(`${base}/services`).expect(200)).body).toEqual([]);
      const all = await api
        .get(`${base}/services?includeArchived=true`)
        .expect(200);
      expect(all.body).toEqual([
        expect.objectContaining({ id: service.id, active: false }),
      ]);

      await api
        .patch(`${base}/services/${service.id}`)
        .send({ active: true })
        .expect(200);
      expect((await api.get(`${base}/services`).expect(200)).body).toHaveLength(
        1,
      );
    });
  });

  describe('staff', () => {
    it('assigns services and replaces them on update', async () => {
      const { body: cut } = await createService({ name: 'Cut' }).expect(201);
      const { body: beard } = await createService({ name: 'Beard' }).expect(
        201,
      );
      const staff = await createStaff({ serviceIds: [cut.id] });

      const res = await api
        .patch(`${base}/staff/${staff.id}`)
        .send({ serviceIds: [beard.id] })
        .expect(200);

      expect(res.body.serviceIds).toEqual([beard.id]);
    });

    it('rejects repeated service ids', async () => {
      const { body: cut } = await createService().expect(201);
      await api
        .post(`${base}/staff`)
        .send({ name: 'Martín', serviceIds: [cut.id, cut.id] })
        .expect(400);
    });
  });

  describe('working hours', () => {
    it('replaces the weekly schedule and returns it sorted', async () => {
      const staff = await createStaff();
      const url = `${base}/staff/${staff.id}/working-hours`;

      await api
        .put(url)
        .send([
          { weekday: 1, start: '15:00', end: '19:00' },
          { weekday: 1, start: '09:00', end: '13:00' },
          { weekday: 6, start: '10:00', end: '14:00' },
        ])
        .expect(200);
      const res = await api
        .put(url)
        .send([{ weekday: 2, start: '09:00', end: '17:00' }]);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ weekday: 2, start: '09:00', end: '17:00' }]);
    });

    it('stores times as minutes since midnight', async () => {
      const staff = await createStaff();
      await api
        .put(`${base}/staff/${staff.id}/working-hours`)
        .send([{ weekday: 3, start: '09:30', end: '24:00' }])
        .expect(200);

      const row = await app.get(PrismaService).workingHours.findFirstOrThrow();
      expect(row).toMatchObject({
        weekday: 3,
        startMinute: 570,
        endMinute: 1440,
      });
    });

    it('accepts back-to-back intervals', async () => {
      const staff = await createStaff();
      await api
        .put(`${base}/staff/${staff.id}/working-hours`)
        .send([
          { weekday: 1, start: '09:00', end: '13:00' },
          { weekday: 1, start: '13:00', end: '17:00' },
        ])
        .expect(200);
    });

    it.each([
      [
        'overlapping intervals',
        [
          { weekday: 1, start: '09:00', end: '13:00' },
          { weekday: 1, start: '12:00', end: '15:00' },
        ],
      ],
      [
        'an end before the start',
        [{ weekday: 1, start: '13:00', end: '09:00' }],
      ],
      ['an invalid time', [{ weekday: 1, start: '9:00', end: '13:00' }]],
      ['an invalid weekday', [{ weekday: 0, start: '09:00', end: '13:00' }]],
    ])(
      'returns 400 for %s and keeps the old schedule',
      async (_case, schedule) => {
        const staff = await createStaff();
        const url = `${base}/staff/${staff.id}/working-hours`;
        await api
          .put(url)
          .send([{ weekday: 5, start: '09:00', end: '18:00' }])
          .expect(200);

        await api.put(url).send(schedule).expect(400);

        expect((await api.get(url).expect(200)).body).toEqual([
          { weekday: 5, start: '09:00', end: '18:00' },
        ]);
      },
    );
  });

  describe('time off', () => {
    it('adds, lists and removes time off', async () => {
      const staff = await createStaff();
      const url = `${base}/staff/${staff.id}/time-off`;

      const created = await api
        .post(url)
        .send({
          startsAt: '2099-12-24T00:00:00-03:00',
          endsAt: '2099-12-26T00:00:00-03:00',
          reason: 'Holidays',
        })
        .expect(201);
      // Stored and returned in UTC.
      expect(created.body.startsAt).toBe('2099-12-24T03:00:00.000Z');
      expect((await api.get(url).expect(200)).body).toHaveLength(1);

      await api.delete(`${url}/${created.body.id}`).expect(204);
      expect((await api.get(url).expect(200)).body).toEqual([]);
    });

    it.each([
      [
        'an end before the start',
        { startsAt: '2099-01-02T10:00:00Z', endsAt: '2099-01-01T10:00:00Z' },
      ],
      [
        'a date without a time zone',
        { startsAt: '2099-01-01T10:00:00', endsAt: '2099-01-02T10:00:00' },
      ],
      [
        'more than a year',
        { startsAt: '2099-01-01T00:00:00Z', endsAt: '2100-06-01T00:00:00Z' },
      ],
    ])('returns 400 for %s', async (_case, body) => {
      const staff = await createStaff();
      await api
        .post(`${base}/staff/${staff.id}/time-off`)
        .send(body)
        .expect(400);
    });
  });

  describe('database constraints (second line of defense)', () => {
    it('rejects invalid rows even when the API validation is bypassed', async () => {
      const prisma = app.get(PrismaService);
      const staff = await createStaff();

      await expect(
        prisma.workingHours.create({
          data: {
            staffId: staff.id,
            weekday: 1,
            startMinute: 600,
            endMinute: 540,
          },
        }),
      ).rejects.toThrow(/working_hours_end_after_start/);
    });
  });
});
