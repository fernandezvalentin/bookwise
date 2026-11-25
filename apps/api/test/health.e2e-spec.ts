import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaPg } from '@prisma/adapter-pg';
import { AppModule } from '../src/app.module.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('GET /health', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('returns 200 when the database is reachable', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(res.body.status).toBe('ok');
    expect(res.body.info.database.status).toBe('up');
  });

  it('returns 503 when the database is down', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      // A real client pointed at a port where nothing is listening.
      .useValue(
        new PrismaClient({
          adapter: new PrismaPg({
            connectionString:
              'postgresql://bookwise:bookwise@127.0.0.1:1/bookwise',
            connectionTimeoutMillis: 500,
          }),
        }),
      )
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();

    const res = await request(app.getHttpServer()).get('/health').expect(503);

    expect(res.body.status).toBe('error');
    expect(res.body.error.database.status).toBe('down');
  });
});
