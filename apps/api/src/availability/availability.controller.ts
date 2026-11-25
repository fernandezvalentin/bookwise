import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/public.decorator.js';
import { slugSchema } from '../common/slug.js';
import {
  availabilityQuerySchema,
  type AvailabilityQuery,
} from './availability.schemas.js';
import { AvailabilityService } from './availability.service.js';

@ApiTags('public')
@Public()
@Controller('public/businesses/:slug/availability')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  /**
   * Free time slots for a service, between two local dates (inclusive). Each
   * slot lists the staff members free at that time.
   */
  @Get()
  @ApiBadRequestResponse({
    description: 'Invalid query (dates, range over 31 days...)',
  })
  @ApiNotFoundResponse({
    description: 'Business, service or staff member not found',
  })
  find(
    @Param('slug', { schema: slugSchema }) slug: string,
    @Query({ schema: availabilityQuerySchema }) query: AvailabilityQuery,
  ) {
    return this.availability.forPublicBooking(slug, query);
  }
}
