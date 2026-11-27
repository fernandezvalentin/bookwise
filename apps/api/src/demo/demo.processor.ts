import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { DEMO_QUEUE, DemoService, RESET_DEMO_JOB } from './demo.service.js';

@Processor(DEMO_QUEUE)
export class DemoProcessor extends WorkerHost {
  constructor(private readonly demo: DemoService) {
    super();
  }

  async process(job: Job): Promise<string> {
    if (job.name !== RESET_DEMO_JOB)
      throw new Error(`Unknown job: ${job.name}`);
    return this.demo.reset();
  }
}
