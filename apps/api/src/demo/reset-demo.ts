/**
 * Resets the demo business from the command line:
 *
 *   npm run build -w apps/api && npm run demo:reset -w apps/api
 *
 * In production it runs inside the API container (see the README). Uses the
 * same DEMO_OWNER_* variables as the API.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { validateEnv } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { resetDemo } from './demo-reset.js';

const env = validateEnv(process.env);
if (!env.DEMO_OWNER_EMAIL || !env.DEMO_OWNER_PASSWORD) {
  console.error('Set DEMO_OWNER_EMAIL and DEMO_OWNER_PASSWORD first.');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});
try {
  const result = await resetDemo(prisma, {
    email: env.DEMO_OWNER_EMAIL,
    password: env.DEMO_OWNER_PASSWORD,
  });
  console.log(
    `Demo business ${result.businessId} reset: ${result.services} services, ${result.staff} staff, ${result.bookings} bookings.`,
  );
} finally {
  await prisma.$disconnect();
}
