import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp, setupSwagger } from './app.setup.js';
import type { Env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  setupSwagger(app);

  const config = app.get(ConfigService<Env, true>);
  // Behind a reverse proxy, req.ip (and so the auth rate limit) uses the
  // visitor's address from X-Forwarded-For, set by trusted hops only.
  const trustProxy = config.get('TRUST_PROXY', { infer: true });
  // A number means "trust that many hops"; anything else is a list of
  // addresses, subnets or names such as "loopback, uniquelocal".
  if (trustProxy)
    app.set(
      'trust proxy',
      /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy,
    );

  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();
