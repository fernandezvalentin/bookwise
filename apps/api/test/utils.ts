import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/** Boots the full app (same setup as main.ts) against the test database. */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

/**
 * Empties every table (except Prisma's migration history), so each test starts
 * from a clean database. Reads the table list, so new tables are covered too.
 */
export async function resetDatabase(app: INestApplication) {
  const prisma = app.get(PrismaService);
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`,
  );
}

export interface TestUser {
  email: string;
  password: string;
  name: string;
}

let userCounter = 0;

export function buildUser(overrides: Partial<TestUser> = {}): TestUser {
  userCounter += 1;
  return {
    email: `user${userCounter}@example.com`,
    password: 'correct-horse-battery',
    name: `User ${userCounter}`,
    ...overrides,
  };
}

/** Registers a user through the API and returns its credentials and tokens. */
export async function registerUser(
  app: INestApplication,
  overrides: Partial<TestUser> = {},
) {
  const user = buildUser(overrides);
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send(user)
    .expect(201);
  return {
    user,
    accessToken: res.body.accessToken as string,
    refreshToken: res.body.refreshToken as string,
  };
}

/** Supertest agent that sends the access token on every request. */
export function as(app: INestApplication, accessToken: string) {
  const server = app.getHttpServer();
  const auth = { Authorization: `Bearer ${accessToken}` };
  return {
    get: (url: string) => request(server).get(url).set(auth),
    post: (url: string) => request(server).post(url).set(auth),
    put: (url: string) => request(server).put(url).set(auth),
    patch: (url: string) => request(server).patch(url).set(auth),
    delete: (url: string) => request(server).delete(url).set(auth),
  };
}

let businessCounter = 0;

/** A registered user who owns a new business. */
export async function createOwnerWithBusiness(app: INestApplication) {
  const owner = await registerUser(app);
  businessCounter += 1;
  const res = await as(app, owner.accessToken)
    .post('/businesses')
    .send({
      name: `Business ${businessCounter}`,
      timezone: 'America/Argentina/Buenos_Aires',
    })
    .expect(201);
  return {
    owner,
    business: res.body as { id: string; slug: string; name: string },
  };
}
