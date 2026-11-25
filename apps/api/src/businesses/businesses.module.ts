import { Module } from '@nestjs/common';
import { BusinessAccessGuard } from './business-access.js';
import {
  BusinessesController,
  MembersController,
  PublicBusinessesController,
} from './businesses.controller.js';
import { BusinessesService } from './businesses.service.js';
import { MembersService } from './members.service.js';

@Module({
  controllers: [
    BusinessesController,
    MembersController,
    PublicBusinessesController,
  ],
  providers: [BusinessesService, MembersService, BusinessAccessGuard],
  exports: [BusinessAccessGuard],
})
export class BusinessesModule {}
