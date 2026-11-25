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
import { booleanQuery } from '../common/query.js';
import {
  BusinessAccessGuard,
  BusinessRoles,
} from '../businesses/business-access.js';
import {
  createServiceSchema,
  updateServiceSchema,
  type CreateServiceDto,
  type UpdateServiceDto,
} from './services.schemas.js';
import { ServicesService } from './services.service.js';

@ApiTags('services')
@ApiBearerAuth()
@ApiBadRequestResponse({ description: 'Invalid request' })
@ApiNotFoundResponse({ description: 'Business or service not found' })
@ApiForbiddenResponse({ description: 'Only owners can change the catalog' })
@UseGuards(BusinessAccessGuard)
@Controller('businesses/:businessId/services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  list(
    @Param('businessId') businessId: string,
    @Query({ schema: z.strictObject({ includeArchived: booleanQuery }) })
    query: { includeArchived: boolean },
  ) {
    return this.services.list(businessId, query.includeArchived);
  }

  @Post()
  @BusinessRoles('OWNER')
  create(
    @Param('businessId') businessId: string,
    @Body({ schema: createServiceSchema }) dto: CreateServiceDto,
  ) {
    return this.services.create(businessId, dto);
  }

  @Patch(':serviceId')
  @BusinessRoles('OWNER')
  update(
    @Param('businessId') businessId: string,
    @Param('serviceId', { schema: z.uuid() }) serviceId: string,
    @Body({ schema: updateServiceSchema }) dto: UpdateServiceDto,
  ) {
    return this.services.update(businessId, serviceId, dto);
  }

  /** Archives the service (it can be restored with PATCH `{ "active": true }`). */
  @Delete(':serviceId')
  @BusinessRoles('OWNER')
  @HttpCode(HttpStatus.NO_CONTENT)
  archive(
    @Param('businessId') businessId: string,
    @Param('serviceId', { schema: z.uuid() }) serviceId: string,
  ) {
    return this.services.archive(businessId, serviceId);
  }
}
