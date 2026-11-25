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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Public } from '../auth/public.decorator.js';
import { slugSchema } from '../common/slug.js';
import { BusinessAccessGuard, BusinessRoles } from './business-access.js';
import {
  addMemberSchema,
  createBusinessSchema,
  updateBusinessSchema,
  updateMemberSchema,
  type AddMemberDto,
  type CreateBusinessDto,
  type UpdateBusinessDto,
  type UpdateMemberDto,
} from './businesses.schemas.js';
import { BusinessesService } from './businesses.service.js';
import { MembersService } from './members.service.js';
import { z } from 'zod';

@ApiTags('businesses')
@ApiBearerAuth()
@ApiBadRequestResponse({ description: 'Invalid request' })
@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  /** Any signed-in user can create a business and becomes its owner. */
  @Post()
  @ApiConflictResponse({ description: 'That slug is already in use' })
  create(
    @CurrentUser() user: AuthUser,
    @Body({ schema: createBusinessSchema }) dto: CreateBusinessDto,
  ) {
    return this.businesses.create(user.id, dto);
  }

  /** Businesses the signed-in user belongs to. */
  @Get()
  listMine(@CurrentUser() user: AuthUser) {
    return this.businesses.listForUser(user.id);
  }

  @Get(':businessId')
  @UseGuards(BusinessAccessGuard)
  @ApiNotFoundResponse({ description: 'Business not found or not a member' })
  findOne(@Param('businessId') businessId: string) {
    return this.businesses.findById(businessId);
  }

  @Patch(':businessId')
  @UseGuards(BusinessAccessGuard)
  @BusinessRoles('OWNER')
  @ApiForbiddenResponse({ description: 'Only owners can edit the business' })
  @ApiConflictResponse({ description: 'That slug is already in use' })
  update(
    @Param('businessId') businessId: string,
    @Body({ schema: updateBusinessSchema }) dto: UpdateBusinessDto,
  ) {
    return this.businesses.update(businessId, dto);
  }
}

@ApiTags('members')
@ApiBearerAuth()
@ApiNotFoundResponse({ description: 'Business or member not found' })
@UseGuards(BusinessAccessGuard)
@Controller('businesses/:businessId/members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  list(@Param('businessId') businessId: string) {
    return this.members.list(businessId);
  }

  /** Adds an existing user to the business. */
  @Post()
  @BusinessRoles('OWNER')
  @ApiConflictResponse({ description: 'User is already a member' })
  add(
    @Param('businessId') businessId: string,
    @Body({ schema: addMemberSchema }) dto: AddMemberDto,
  ) {
    return this.members.add(businessId, dto);
  }

  @Patch(':userId')
  @BusinessRoles('OWNER')
  @ApiConflictResponse({ description: 'A business needs at least one owner' })
  changeRole(
    @Param('businessId') businessId: string,
    @Param('userId', { schema: z.uuid() }) userId: string,
    @Body({ schema: updateMemberSchema }) dto: UpdateMemberDto,
  ) {
    return this.members.changeRole(businessId, userId, dto.role);
  }

  @Delete(':userId')
  @BusinessRoles('OWNER')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiConflictResponse({ description: 'A business needs at least one owner' })
  remove(
    @Param('businessId') businessId: string,
    @Param('userId', { schema: z.uuid() }) userId: string,
  ) {
    return this.members.remove(businessId, userId);
  }
}

/** Data for the public booking page. No authentication. */
@ApiTags('public')
@Public()
@Controller('public/businesses')
export class PublicBusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  @Get(':slug')
  @ApiNotFoundResponse({ description: 'Business not found' })
  findBySlug(@Param('slug', { schema: slugSchema }) slug: string) {
    return this.businesses.findPublicBySlug(slug);
  }
}
