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

/** Empties every table, so each test starts from a clean database. */
export async function resetDatabase(app: INestApplication) {
  const prisma = app.get(PrismaService);
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE users, refresh_tokens RESTART IDENTITY CASCADE',
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
