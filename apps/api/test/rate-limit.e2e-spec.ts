import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

describe('Auth rate limiting', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // A low limit for this file only. Vitest isolates modules per test file, so
    // the app is imported after setting the variable the config reads.
    process.env.AUTH_RATE_LIMIT = '3';
    const { createTestApp } = await import('./utils.js');
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 429 after too many sign-in attempts from the same IP', async () => {
    const attempt = () =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'someone@example.com', password: 'guessing' });

    for (let i = 0; i < 3; i++) {
      await attempt().expect(401);
    }
    await attempt().expect(429);
  });
});
