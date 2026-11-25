import { INestApplication, StandardSchemaValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * App-wide setup shared by `main.ts` and the e2e tests, so the tests exercise
 * the same validation and behavior as the real server.
 */
export function configureApp(app: INestApplication) {
  // Validates every parameter declared with `{ schema }` (Zod) and returns 400 on errors.
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  // Closes the database pool cleanly on SIGTERM (Docker, Render, Ctrl+C).
  app.enableShutdownHooks();
}

/** Interactive API docs at /docs (JSON at /docs-json). */
export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Bookwise API')
    .setDescription('Multi-tenant appointment booking platform')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, () =>
    SwaggerModule.createDocument(app, config),
  );
}
