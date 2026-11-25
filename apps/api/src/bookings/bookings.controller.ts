import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiTags,
} from '@nestjs/swagger';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { BusinessAccessGuard } from '../businesses/business-access.js';
import {
  businessBookingsQuerySchema,
  createBookingSchema,
  myBookingsQuerySchema,
  rescheduleBookingSchema,
  type BusinessBookingsQuery,
  type CreateBookingDto,
  type RescheduleBookingDto,
} from './bookings.schemas.js';
import { BookingsService } from './bookings.service.js';

const bookingId = z.uuid();

@ApiTags('bookings')
@ApiBearerAuth()
@ApiBadRequestResponse({ description: 'Invalid request' })
@Controller()
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  /** Books a slot for the signed-in user (use a slot from the availability endpoint). */
  @Post('bookings')
  @ApiNotFoundResponse({ description: 'Business, service or staff not found' })
  @ApiConflictResponse({
    description: 'The time is not available or was just booked',
  })
  create(
    @CurrentUser() user: AuthUser,
    @Body({ schema: createBookingSchema }) dto: CreateBookingDto,
  ) {
    return this.bookings.create(user.id, dto);
  }

  /** Bookings of the signed-in user. */
  @Get('me/bookings')
  listMine(
    @CurrentUser() user: AuthUser,
    @Query({ schema: myBookingsQuerySchema })
    query: z.infer<typeof myBookingsQuerySchema>,
  ) {
    return this.bookings.listForCustomer(user.id, query.scope);
  }

  /** Visible to the customer and to members of the business. */
  @Get('bookings/:bookingId')
  @ApiNotFoundResponse({ description: 'Booking not found' })
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('bookingId', { schema: bookingId }) id: string,
  ) {
    return this.bookings.findOne(id, user.id);
  }

  @Post('bookings/:bookingId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiNotFoundResponse({ description: 'Booking not found' })
  @ApiConflictResponse({ description: 'The booking already started' })
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('bookingId', { schema: bookingId }) id: string,
  ) {
    return this.bookings.cancel(id, user.id);
  }

  @Post('bookings/:bookingId/reschedule')
  @HttpCode(HttpStatus.OK)
  @ApiNotFoundResponse({ description: 'Booking not found' })
  @ApiConflictResponse({ description: 'The new time is not available' })
  reschedule(
    @CurrentUser() user: AuthUser,
    @Param('bookingId', { schema: bookingId }) id: string,
    @Body({ schema: rescheduleBookingSchema }) dto: RescheduleBookingDto,
  ) {
    return this.bookings.reschedule(id, user.id, dto);
  }

  /** The business agenda: bookings between two local dates. Any member. */
  @Get('businesses/:businessId/bookings')
  @UseGuards(BusinessAccessGuard)
  @ApiNotFoundResponse({ description: 'Business not found' })
  listForBusiness(
    @Param('businessId') businessId: string,
    @Query({ schema: businessBookingsQuerySchema })
    query: BusinessBookingsQuery,
  ) {
    return this.bookings.listForBusiness(businessId, query);
  }
}
