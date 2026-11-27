import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DemoProcessor } from './demo.processor.js';
import { DEMO_QUEUE, DemoService } from './demo.service.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: DEMO_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { count: 30 },
        removeOnFail: { count: 30 },
      },
    }),
  ],
  providers: [DemoService, DemoProcessor],
})
export class DemoModule {}
