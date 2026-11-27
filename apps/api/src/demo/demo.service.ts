import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DEMO_BUSINESS_ID, DEMO_TIMEZONE } from './demo-data.js';
import { resetDemo, type DemoOwner } from './demo-reset.js';

export const DEMO_QUEUE = 'demo';
export const RESET_DEMO_JOB = 'reset-demo';

/**
 * Keeps the public demo business in shape. Enabled only when the demo owner
 * account is configured. The reset runs as a queue job, so with several API
 * instances it still happens once, and a failed reset is retried.
 */
@Injectable()
export class DemoService implements OnModuleInit {
  private readonly logger = new Logger(DemoService.name);
  private readonly owner: DemoOwner | null;

  constructor(
    @InjectQueue(DEMO_QUEUE) private readonly queue: Queue,
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    const email = config.get('DEMO_OWNER_EMAIL', { infer: true });
    const password = config.get('DEMO_OWNER_PASSWORD', { infer: true });
    this.owner = email && password ? { email, password } : null;
  }

  get enabled(): boolean {
    return this.owner !== null;
  }

  async onModuleInit() {
    if (!this.owner) {
      // Drop a schedule left by an earlier run that had the demo enabled.
      await this.queue.removeJobScheduler(RESET_DEMO_JOB);
      return;
    }

    // Every night at 04:00 in the demo's time zone (idempotent across restarts).
    await this.queue.upsertJobScheduler(
      RESET_DEMO_JOB,
      { pattern: '0 4 * * *', tz: DEMO_TIMEZONE },
      { name: RESET_DEMO_JOB },
    );

    // First deploy: create the demo right away instead of waiting for 04:00.
    const exists = await this.prisma.business.count({
      where: { id: DEMO_BUSINESS_ID },
    });
    if (!exists) await this.queue.add(RESET_DEMO_JOB, {});
  }

  async reset(): Promise<string> {
    if (!this.owner) return 'demo disabled';
    const result = await resetDemo(this.prisma, this.owner);
    const summary = `${result.services} services, ${result.staff} staff, ${result.bookings} bookings`;
    this.logger.log(`Demo business reset: ${summary}`);
    return summary;
  }
}
