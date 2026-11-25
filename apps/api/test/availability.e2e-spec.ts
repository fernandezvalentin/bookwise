import type { INestApplication } from '@nestjs/common';
import { DateTime } from 'luxon';
import request from 'supertest';
import {
  as,
  createOwnerWithBusiness,
  createTestApp,
  resetDatabase,
} from './utils.js';

/** A Monday far in the future, so "only future slots" never interferes. */
const MONDAY = '2099-01-05';
const TUESDAY = '2099-01-06';

describe('GET /public/businesses/:slug/availability', () => {
  let app: INestApplication;
  let api: ReturnType<typeof as>;
  let base: string;
  let slug: string;
  let serviceId: string;
  let martinId: string;

  const availability = (query: Record<string, string>) =>
    request(app.getHttpServer())
      .get(`/public/businesses/${slug}/availability`)
      .query(query);

  const localTimes = (body: { slots: { localTime: string }[] }) =>
    body.slots.map((s) => s.localTime);

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    const { owner, business } = await createOwnerWithBusiness(app);
    api = as(app, owner.accessToken);
    base = `/businesses/${business.id}`;
    slug = business.slug;

    serviceId = (
      await api
        .post(`${base}/services`)
        .send({ name: 'Haircut', durationMin: 60, priceCents: 1000 })
        .expect(201)
    ).body.id;
    martinId = (
      await api
        .post(`${base}/staff`)
        .send({ name: 'Martín', serviceIds: [serviceId] })
        .expect(201)
    ).body.id;
    await api
      .put(`${base}/staff/${martinId}/working-hours`)
      .send([{ weekday: 1, start: '09:00', end: '11:00' }])
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the free slots in the business time zone', async () => {
    const res = await availability({ serviceId, from: MONDAY }).expect(200);

    expect(res.body).toMatchObject({
      timezone: 'America/Argentina/Buenos_Aires',
      serviceId,
      durationMin: 60,
      from: MONDAY,
      to: MONDAY,
    });
    expect(localTimes(res.body)).toEqual([
      '09:00',
      '09:15',
      '09:30',
      '09:45',
      '10:00',
    ]);
    expect(res.body.slots[0]).toEqual({
      start: '2099-01-05T12:00:00.000Z',
      end: '2099-01-05T13:00:00.000Z',
      localDate: MONDAY,
      localTime: '09:00',
      staffIds: [martinId],
    });
  });

  it('lists every staff member free at each time, and can filter by one', async () => {
    const luciaId = (
      await api
        .post(`${base}/staff`)
        .send({ name: 'Lucía', serviceIds: [serviceId] })
        .expect(201)
    ).body.id;
    await api
      .put(`${base}/staff/${luciaId}/working-hours`)
      .send([{ weekday: 1, start: '10:00', end: '12:00' }])
      .expect(200);

    const all = await availability({ serviceId, from: MONDAY }).expect(200);
    const at10 = all.body.slots.find(
      (s: { localTime: string }) => s.localTime === '10:00',
    );
    expect(at10.staffIds.sort()).toEqual([martinId, luciaId].sort());

    const onlyLucia = await availability({
      serviceId,
      staffId: luciaId,
      from: MONDAY,
    }).expect(200);
    expect(localTimes(onlyLucia.body)).toEqual([
      '10:00',
      '10:15',
      '10:30',
      '10:45',
      '11:00',
    ]);
  });

  it('removes slots covered by time off', async () => {
    await api
      .post(`${base}/staff/${martinId}/time-off`)
      .send({
        startsAt: '2099-01-05T09:30:00-03:00',
        endsAt: '2099-01-05T10:00:00-03:00',
      })
      .expect(201);

    const res = await availability({ serviceId, from: MONDAY }).expect(200);

    // A 60-minute appointment can't overlap 09:30-10:00.
    expect(localTimes(res.body)).toEqual(['10:00']);
  });

  it('ignores staff who are inactive or do not provide the service', async () => {
    await api
      .patch(`${base}/staff/${martinId}`)
      .send({ serviceIds: [] })
      .expect(200);
    expect(
      (await availability({ serviceId, from: MONDAY }).expect(200)).body.slots,
    ).toEqual([]);

    await api
      .patch(`${base}/staff/${martinId}`)
      .send({ serviceIds: [serviceId], active: false });
    expect(
      (await availability({ serviceId, from: MONDAY }).expect(200)).body.slots,
    ).toEqual([]);
  });

  it('returns no slots on days without working hours', async () => {
    const res = await availability({ serviceId, from: TUESDAY }).expect(200);
    expect(res.body.slots).toEqual([]);
  });

  it('never offers slots in the past', async () => {
    const lastWeek = DateTime.now().minus({ weeks: 1 }).toISODate()!;
    const today = DateTime.now().toISODate()!;
    await api
      .put(`${base}/staff/${martinId}/working-hours`)
      .send(
        [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
          weekday,
          start: '00:00',
          end: '24:00',
        })),
      )
      .expect(200);

    const res = await availability({
      serviceId,
      from: lastWeek,
      to: today,
    }).expect(200);

    const now = Date.now();
    expect(
      res.body.slots.every(
        (s: { start: string }) => Date.parse(s.start) >= now - 1000,
      ),
    ).toBe(true);
  });

  it('returns 404 for an archived service or a staff member who does not provide it', async () => {
    const otherStaff = (
      await api.post(`${base}/staff`).send({ name: 'Ana' }).expect(201)
    ).body.id;
    await availability({ serviceId, staffId: otherStaff, from: MONDAY }).expect(
      404,
    );

    await api.delete(`${base}/services/${serviceId}`).expect(204);
    await availability({ serviceId, from: MONDAY }).expect(404);
  });

  it.each([
    ['a missing serviceId', () => ({ from: MONDAY })],
    ['an invalid date', () => ({ serviceId, from: '2099-13-01' })],
    ['to before from', () => ({ serviceId, from: TUESDAY, to: MONDAY })],
    [
      'a range over 31 days',
      () => ({ serviceId, from: '2099-01-01', to: '2099-02-01' }),
    ],
    [
      'an unknown parameter',
      () => ({ serviceId, from: MONDAY, timezone: 'UTC' }),
    ],
  ])('returns 400 for %s', async (_case, buildQuery) => {
    // A function, because serviceId is only known once beforeEach has run.
    await availability(buildQuery()).expect(400);
  });

  it('accepts a range of exactly 31 days', async () => {
    const res = await availability({
      serviceId,
      from: '2099-01-01',
      to: '2099-01-31',
    }).expect(200);
    // Mondays in January 2099: 5, 12, 19, 26.
    const days = new Set(
      res.body.slots.map((s: { localDate: string }) => s.localDate),
    );
    expect([...days]).toEqual([
      '2099-01-05',
      '2099-01-12',
      '2099-01-19',
      '2099-01-26',
    ]);
  });
});
