import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module.js';
import { NOTIFICATIONS_QUEUE } from './notifications.constants.js';
import { NotificationsProcessor } from './notifications.processor.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [
    MailModule,
    BullModule.registerQueue({
      name: NOTIFICATIONS_QUEUE,
      defaultJobOptions: {
        // Retries with 2s, 4s, 8s, 16s... between attempts.
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        // Finished jobs are deleted, so a reminder's job id can be reused when
        // a booking is rescheduled. Failed jobs are kept for inspection.
        removeOnComplete: true,
        removeOnFail: { count: 500 },
      },
    }),
  ],
  providers: [NotificationsService, NotificationsProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule {}
