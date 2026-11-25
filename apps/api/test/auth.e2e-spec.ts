import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { TokenService } from '../src/auth/token.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  buildUser,
  createTestApp,
  registerUser,
  resetDatabase,
} from './utils.js';

describe('Auth', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('creates the account and returns a token pair', async () => {
      const res = await http()
        .post('/auth/register')
        .send(buildUser())
        .expect(201);

      expect(res.body).toEqual({
        tokenType: 'Bearer',
        accessToken: expect.any(String),
        expiresIn: 900,
        refreshToken: expect.any(String),
      });
    });

    it('stores the password hashed, never in plain text', async () => {
      const user = buildUser();
      await http().post('/auth/register').send(user).expect(201);

      const saved = await app.get(PrismaService).user.findUniqueOrThrow({
        where: { email: user.email },
      });
      expect(saved.passwordHash).not.toContain(user.password);
      expect(saved.passwordHash).toMatch(/^\$argon2id\$/);
    });

    it('rejects an email that is already registered, ignoring case', async () => {
      await registerUser(app, { email: 'ana@example.com' });

      await http()
        .post('/auth/register')
        .send(buildUser({ email: 'ANA@example.com' }))
        .expect(409);
    });

    it.each([
      ['an invalid email', { email: 'not-an-email' }],
      ['a short password', { password: 'short' }],
      ['an empty name', { name: '   ' }],
      ['an unknown field', { role: 'admin' }],
    ])('returns 400 for %s', async (_case, overrides) => {
      const res = await http()
        .post('/auth/register')
        .send({ ...buildUser(), ...overrides })
        .expect(400);

      expect(res.body.message).toEqual(expect.any(Array));
    });
  });

  describe('POST /auth/login', () => {
    it('signs in with the right credentials (email is case-insensitive)', async () => {
      const { user } = await registerUser(app, { email: 'bob@example.com' });

      const res = await http()
        .post('/auth/login')
        .send({ email: 'BOB@example.com', password: user.password })
        .expect(200);

      expect(res.body.accessToken).toEqual(expect.any(String));
    });

    it('returns the same 401 for a wrong password and for an unknown email', async () => {
      const { user } = await registerUser(app);

      const wrongPassword = await http()
        .post('/auth/login')
        .send({ email: user.email, password: 'wrong-password' })
        .expect(401);
      const unknownEmail = await http()
        .post('/auth/login')
        .send({ email: 'nobody@example.com', password: user.password })
        .expect(401);

      expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
    });
  });

  describe('GET /me', () => {
    it('returns the signed-in user without the password hash', async () => {
      const { user, accessToken } = await registerUser(app);

      const res = await http()
        .get('/me')
        .auth(accessToken, { type: 'bearer' })
        .expect(200);

      expect(res.body).toEqual({
        id: expect.any(String),
        email: user.email,
        name: user.name,
        createdAt: expect.any(String),
      });
    });

    it('returns 401 without a token', async () => {
      await http().get('/me').expect(401);
    });

    it('returns 401 for a malformed token', async () => {
      await http().get('/me').auth('not-a-jwt', { type: 'bearer' }).expect(401);
    });

    it('returns 401 for a token signed with another secret', async () => {
      const forged = new JwtService({
        secret: 'another-secret-that-is-long-enough-123456',
      });
      const token = await forged.signAsync({ sub: crypto.randomUUID() });

      await http().get('/me').auth(token, { type: 'bearer' }).expect(401);
    });

    it('returns 401 for an expired token', async () => {
      const { accessToken } = await registerUser(app);
      const jwt = app.get(JwtService);
      const { sub } = jwt.decode<{ sub: string }>(accessToken);
      const expired = await jwt.signAsync({
        sub,
        exp: Math.floor(Date.now() / 1000) - 10,
      });

      await http().get('/me').auth(expired, { type: 'bearer' }).expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('returns a new token pair and revokes the refresh token used', async () => {
      const { refreshToken } = await registerUser(app);

      const res = await http()
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(res.body.refreshToken).not.toBe(refreshToken);
      await http()
        .get('/me')
        .auth(res.body.accessToken, { type: 'bearer' })
        .expect(200);
    });

    it('detects reuse: an old refresh token revokes the whole session', async () => {
      const { refreshToken: first } = await registerUser(app);
      const rotated = await http()
        .post('/auth/refresh')
        .send({ refreshToken: first })
        .expect(200);
      const second = rotated.body.refreshToken as string;

      // Someone replays the first token (e.g. it was stolen)...
      await http()
        .post('/auth/refresh')
        .send({ refreshToken: first })
        .expect(401);

      // ...so the latest token of that session stops working too.
      await http()
        .post('/auth/refresh')
        .send({ refreshToken: second })
        .expect(401);
    });

    it('lets only one of several simultaneous refreshes succeed', async () => {
      const { refreshToken } = await registerUser(app);
      const tokens = app.get(TokenService);

      // Called on the service directly: over HTTP the requests arrive one after
      // another and the race never happens. Here all five read the token before
      // any of them revokes it, which is the case the compare-and-set protects.
      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () => tokens.rotate(refreshToken)),
      );

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(4);
    });

    it('rejects an expired refresh token', async () => {
      const { refreshToken } = await registerUser(app);
      await app.get(PrismaService).refreshToken.updateMany({
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await http().post('/auth/refresh').send({ refreshToken }).expect(401);
    });

    it('rejects an unknown refresh token', async () => {
      await http()
        .post('/auth/refresh')
        .send({ refreshToken: 'made-up' })
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes the session, so its refresh token stops working', async () => {
      const { refreshToken } = await registerUser(app);

      await http().post('/auth/logout').send({ refreshToken }).expect(204);

      await http().post('/auth/refresh').send({ refreshToken }).expect(401);
    });

    it('only signs out that session, not the other devices', async () => {
      const { user, refreshToken: phone } = await registerUser(app);
      const laptop = await http()
        .post('/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(200);

      await http()
        .post('/auth/logout')
        .send({ refreshToken: phone })
        .expect(204);

      await http()
        .post('/auth/refresh')
        .send({ refreshToken: laptop.body.refreshToken })
        .expect(200);
    });
  });
});
