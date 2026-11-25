import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MembersService } from '../src/businesses/members.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  as,
  createOwnerWithBusiness,
  createTestApp,
  registerUser,
  resetDatabase,
} from './utils.js';

describe('Businesses and members', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /businesses', () => {
    it('creates the business and makes the creator its owner', async () => {
      const { accessToken } = await registerUser(app);

      const res = await as(app, accessToken)
        .post('/businesses')
        .send({
          name: 'Barbería Centro',
          timezone: 'America/Argentina/Buenos_Aires',
        })
        .expect(201);

      expect(res.body).toMatchObject({
        name: 'Barbería Centro',
        slug: 'barberia-centro',
        timezone: 'America/Argentina/Buenos_Aires',
        role: 'OWNER',
      });
      const mine = await as(app, accessToken).get('/businesses').expect(200);
      expect(mine.body).toEqual([
        expect.objectContaining({ id: res.body.id, role: 'OWNER' }),
      ]);
    });

    it('adds a suffix when the generated slug is taken', async () => {
      const { accessToken } = await registerUser(app);
      const body = { name: 'Studio', timezone: 'UTC' };

      await as(app, accessToken).post('/businesses').send(body).expect(201);
      const second = await as(app, accessToken)
        .post('/businesses')
        .send(body)
        .expect(201);

      expect(second.body.slug).toMatch(/^studio-[0-9a-f]{6}$/);
    });

    it('returns 409 when an explicit slug is taken', async () => {
      const { accessToken } = await registerUser(app);
      const body = { name: 'Studio', slug: 'my-studio', timezone: 'UTC' };

      await as(app, accessToken).post('/businesses').send(body).expect(201);
      await as(app, accessToken).post('/businesses').send(body).expect(409);
    });

    it.each([
      ['an unknown time zone', { timezone: 'Mars/Base' }],
      ['an invalid slug', { slug: 'Not A Slug' }],
    ])('returns 400 for %s', async (_case, overrides) => {
      const { accessToken } = await registerUser(app);
      await as(app, accessToken)
        .post('/businesses')
        .send({ name: 'Studio', timezone: 'UTC', ...overrides })
        .expect(400);
    });

    it('requires authentication', async () => {
      await request(app.getHttpServer())
        .post('/businesses')
        .send({})
        .expect(401);
    });
  });

  describe('tenant isolation', () => {
    it('hides a business from users who are not members (404, not 403)', async () => {
      const { business } = await createOwnerWithBusiness(app);
      const outsider = await registerUser(app);

      await as(app, outsider.accessToken)
        .get(`/businesses/${business.id}`)
        .expect(404);
      await as(app, outsider.accessToken)
        .get(`/businesses/${business.id}/services`)
        .expect(404);
      await as(app, outsider.accessToken)
        .patch(`/businesses/${business.id}`)
        .send({ name: 'Hacked' })
        .expect(404);
    });

    it('returns 404 for a malformed business id', async () => {
      const { accessToken } = await registerUser(app);
      await as(app, accessToken).get('/businesses/not-a-uuid').expect(404);
    });

    it("can't reach another business's records through your own business", async () => {
      const a = await createOwnerWithBusiness(app);
      const b = await createOwnerWithBusiness(app);
      const serviceOfA = await as(app, a.owner.accessToken)
        .post(`/businesses/${a.business.id}/services`)
        .send({ name: 'Cut', durationMin: 30, priceCents: 1000 })
        .expect(201);

      // B is a legit owner of its own business, but the service is A's.
      await as(app, b.owner.accessToken)
        .patch(`/businesses/${b.business.id}/services/${serviceOfA.body.id}`)
        .send({ priceCents: 1 })
        .expect(404);
      await as(app, b.owner.accessToken)
        .post(`/businesses/${b.business.id}/staff`)
        .send({ name: 'Intruder', serviceIds: [serviceOfA.body.id] })
        .expect(400);
    });
  });

  describe('members and roles', () => {
    it('lets an owner add an existing user as staff', async () => {
      const { owner, business } = await createOwnerWithBusiness(app);
      const colleague = await registerUser(app);

      await as(app, owner.accessToken)
        .post(`/businesses/${business.id}/members`)
        .send({ email: colleague.user.email.toUpperCase(), role: 'STAFF' })
        .expect(201);

      const mine = await as(app, colleague.accessToken)
        .get('/businesses')
        .expect(200);
      expect(mine.body).toEqual([
        expect.objectContaining({ id: business.id, role: 'STAFF' }),
      ]);
    });

    it('gives staff read access but not write access', async () => {
      const { owner, business } = await createOwnerWithBusiness(app);
      const colleague = await registerUser(app);
      await as(app, owner.accessToken)
        .post(`/businesses/${business.id}/members`)
        .send({ email: colleague.user.email, role: 'STAFF' })
        .expect(201);

      const staff = as(app, colleague.accessToken);
      await staff.get(`/businesses/${business.id}`).expect(200);
      await staff.get(`/businesses/${business.id}/services`).expect(200);
      await staff
        .patch(`/businesses/${business.id}`)
        .send({ name: 'X' })
        .expect(403);
      await staff
        .post(`/businesses/${business.id}/services`)
        .send({ name: 'Cut', durationMin: 30, priceCents: 1000 })
        .expect(403);
    });

    it('returns 404 when adding an email nobody registered', async () => {
      const { owner, business } = await createOwnerWithBusiness(app);
      await as(app, owner.accessToken)
        .post(`/businesses/${business.id}/members`)
        .send({ email: 'ghost@example.com', role: 'STAFF' })
        .expect(404);
    });

    it('returns 409 when the user is already a member', async () => {
      const { owner, business } = await createOwnerWithBusiness(app);
      await as(app, owner.accessToken)
        .post(`/businesses/${business.id}/members`)
        .send({ email: owner.user.email, role: 'STAFF' })
        .expect(409);
    });

    it('never leaves a business without an owner', async () => {
      const { owner, business } = await createOwnerWithBusiness(app);
      const me = await as(app, owner.accessToken).get('/me').expect(200);
      const members = `/businesses/${business.id}/members/${me.body.id}`;

      await as(app, owner.accessToken)
        .patch(members)
        .send({ role: 'STAFF' })
        .expect(409);
      await as(app, owner.accessToken).delete(members).expect(409);
    });

    it('keeps one owner when two owners remove each other at the same time', async () => {
      const members = app.get(MembersService);
      const prisma = app.get(PrismaService);

      // Repeated because a race doesn't show up on every attempt (the first
      // one usually runs on a single pooled connection, one after the other).
      for (let attempt = 0; attempt < 5; attempt++) {
        const { owner, business } = await createOwnerWithBusiness(app);
        const partner = await registerUser(app);
        await as(app, owner.accessToken)
          .post(`/businesses/${business.id}/members`)
          .send({ email: partner.user.email, role: 'OWNER' })
          .expect(201);
        const ownerId = (await as(app, owner.accessToken).get('/me')).body.id;
        const partnerId = (await as(app, partner.accessToken).get('/me')).body
          .id;

        // Called on the service so both transactions really overlap.
        const results = await Promise.allSettled([
          members.remove(business.id, partnerId),
          members.remove(business.id, ownerId),
        ]);

        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
        const owners = await prisma.membership.count({
          where: { businessId: business.id, role: 'OWNER' },
        });
        expect(owners).toBe(1);
      }
    });

    it('lets an owner step down once there is another owner', async () => {
      const { owner, business } = await createOwnerWithBusiness(app);
      const partner = await registerUser(app);
      await as(app, owner.accessToken)
        .post(`/businesses/${business.id}/members`)
        .send({ email: partner.user.email, role: 'OWNER' })
        .expect(201);
      const me = await as(app, owner.accessToken).get('/me').expect(200);

      await as(app, owner.accessToken)
        .delete(`/businesses/${business.id}/members/${me.body.id}`)
        .expect(204);

      await as(app, owner.accessToken)
        .get(`/businesses/${business.id}`)
        .expect(404);
    });
  });

  describe('GET /public/businesses/:slug', () => {
    it('shows active services and staff, without authentication', async () => {
      const { owner, business } = await createOwnerWithBusiness(app);
      const api = as(app, owner.accessToken);
      const cut = await api
        .post(`/businesses/${business.id}/services`)
        .send({ name: 'Cut', durationMin: 30, priceCents: 1000 })
        .expect(201);
      const old = await api
        .post(`/businesses/${business.id}/services`)
        .send({ name: 'Old service', durationMin: 30, priceCents: 1000 })
        .expect(201);
      await api
        .delete(`/businesses/${business.id}/services/${old.body.id}`)
        .expect(204);
      await api
        .post(`/businesses/${business.id}/staff`)
        .send({ name: 'Martín', serviceIds: [cut.body.id, old.body.id] })
        .expect(201);
      const gone = await api
        .post(`/businesses/${business.id}/staff`)
        .send({ name: 'Former employee' })
        .expect(201);
      await api
        .delete(`/businesses/${business.id}/staff/${gone.body.id}`)
        .expect(204);

      const res = await request(app.getHttpServer())
        .get(`/public/businesses/${business.slug}`)
        .expect(200);

      expect(res.body.services.map((s: { name: string }) => s.name)).toEqual([
        'Cut',
      ]);
      expect(res.body.staff).toEqual([
        { id: expect.any(String), name: 'Martín', serviceIds: [cut.body.id] },
      ]);
      expect(res.body).not.toHaveProperty('id');
    });

    it('returns 404 for an unknown slug', async () => {
      await request(app.getHttpServer())
        .get('/public/businesses/nope-nope')
        .expect(404);
    });
  });
});
