import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { AvailabilityModule } from './availability/availability.module.js';
import { BookingsModule } from './bookings/bookings.module.js';
import { BusinessesModule } from './businesses/businesses.module.js';
import { redisConnectionFromUrl } from './common/redis.js';
import { validateEnv, type Env } from './config/env.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ServicesModule } from './services/services.module.js';
import { StaffModule } from './staff/staff.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        connection: redisConnectionFromUrl(
          config.get('REDIS_URL', { infer: true }),
        ),
      }),
    }),
    HealthModule,
    AuthModule,
    UsersModule,
    BusinessesModule,
    ServicesModule,
    StaffModule,
    AvailabilityModule,
    BookingsModule,
  ],
})
export class AppModule {}
