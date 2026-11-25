import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiTags,
} from '@nestjs/swagger';
import { z } from 'zod';
import {
  BusinessAccessGuard,
  BusinessRoles,
} from '../businesses/business-access.js';
import {
  createStaffSchema,
  createTimeOffSchema,
  updateStaffSchema,
  weeklyScheduleSchema,
  type CreateStaffDto,
  type CreateTimeOffDto,
  type UpdateStaffDto,
  type WeeklyScheduleDto,
} from './staff.schemas.js';
import { StaffService } from './staff.service.js';

const id = z.uuid();
const includeInactiveQuery = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

@ApiTags('staff')
@ApiBearerAuth()
@ApiBadRequestResponse({ description: 'Invalid request' })
@ApiNotFoundResponse({
  description: 'Business, staff member or time off not found',
})
@ApiForbiddenResponse({
  description: 'Only owners can change staff and schedules',
})
@UseGuards(BusinessAccessGuard)
@Controller('businesses/:businessId/staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  list(
    @Param('businessId') businessId: string,
    @Query('includeInactive', { schema: includeInactiveQuery })
    includeInactive: boolean,
  ) {
    return this.staff.list(businessId, includeInactive);
  }

  @Post()
  @BusinessRoles('OWNER')
  create(
    @Param('businessId') businessId: string,
    @Body({ schema: createStaffSchema }) dto: CreateStaffDto,
  ) {
    return this.staff.create(businessId, dto);
  }

  @Patch(':staffId')
  @BusinessRoles('OWNER')
  update(
    @Param('businessId') businessId: string,
    @Param('staffId', { schema: id }) staffId: string,
    @Body({ schema: updateStaffSchema }) dto: UpdateStaffDto,
  ) {
    return this.staff.update(businessId, staffId, dto);
  }

  /** Deactivates the staff member (restore with PATCH `{ "active": true }`). */
  @Delete(':staffId')
  @BusinessRoles('OWNER')
  @HttpCode(HttpStatus.NO_CONTENT)
  deactivate(
    @Param('businessId') businessId: string,
    @Param('staffId', { schema: id }) staffId: string,
  ) {
    return this.staff.deactivate(businessId, staffId);
  }

  @Get(':staffId/working-hours')
  getWorkingHours(
    @Param('businessId') businessId: string,
    @Param('staffId', { schema: id }) staffId: string,
  ) {
    return this.staff.getWeeklySchedule(businessId, staffId);
  }

  /** Replaces the whole weekly schedule. Times are in the business's time zone. */
  @Put(':staffId/working-hours')
  @BusinessRoles('OWNER')
  replaceWorkingHours(
    @Param('businessId') businessId: string,
    @Param('staffId', { schema: id }) staffId: string,
    @Body({ schema: weeklyScheduleSchema }) schedule: WeeklyScheduleDto,
  ) {
    return this.staff.replaceWeeklySchedule(businessId, staffId, schedule);
  }

  /** Upcoming and current time off (past entries are omitted). */
  @Get(':staffId/time-off')
  listTimeOff(
    @Param('businessId') businessId: string,
    @Param('staffId', { schema: id }) staffId: string,
  ) {
    return this.staff.listTimeOff(businessId, staffId);
  }

  @Post(':staffId/time-off')
  @BusinessRoles('OWNER')
  addTimeOff(
    @Param('businessId') businessId: string,
    @Param('staffId', { schema: id }) staffId: string,
    @Body({ schema: createTimeOffSchema }) dto: CreateTimeOffDto,
  ) {
    return this.staff.addTimeOff(businessId, staffId, dto);
  }

  @Delete(':staffId/time-off/:timeOffId')
  @BusinessRoles('OWNER')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeTimeOff(
    @Param('businessId') businessId: string,
    @Param('staffId', { schema: id }) staffId: string,
    @Param('timeOffId', { schema: id }) timeOffId: string,
  ) {
    return this.staff.removeTimeOff(businessId, staffId, timeOffId);
  }
}
