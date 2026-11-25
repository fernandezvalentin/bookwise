import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { AvailabilityService } from '../availability/availability.service.js';
import {
  isExclusionViolation,
  isRetryableConflict,
  isRecordNotFound,
  retryOnDeadlock,
} from '../common/prisma-errors.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  BusinessBookingsQuery,
  CreateBookingDto,
  RescheduleBookingDto,
} from './bookings.schemas.js';

const MINUTE_MS = 60_000;

const bookingInclude = {
  business: { select: { name: true, slug: true, timezone: true } },
  staff: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true, email: true } },
} satisfies Prisma.BookingInclude;

type BookingRow = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
  ) {}

  /**
   * Books a slot for the signed-in customer.
   *
   * 1. The requested time must be one of the slots the availability engine
   *    offers (working hours, time off, existing bookings, future only).
   * 2. The insert itself is protected by the `bookings_no_overlap` exclusion
   *    constraint: if another request booked the same staff member in the
   *    meantime, Postgres rejects this one, and we try the next free staff
   *    member (when the customer didn't pick one) or answer 409.
   */
  async create(customerId: string, dto: CreateBookingDto, now = new Date()) {
    const business = await this.prisma.business.findUnique({
      where: { slug: dto.businessSlug },
      select: { id: true, timezone: true },
    });
    if (!business) throw new NotFoundException('Business not found');
    const service = await this.availability.findBookableService(
      business.id,
      dto.serviceId,
    );

    const startsAt = new Date(dto.startsAt);
    const candidates = await this.freeStaffAt(startsAt, {
      business,
      service,
      staffId: dto.staffId,
      now,
    });

    for (const staffId of candidates) {
      try {
        const booking = await retryOnDeadlock(() =>
          this.prisma.booking.create({
            data: {
              businessId: business.id,
              serviceId: service.id,
              staffId,
              customerId,
              ...timesFor(startsAt, service),
              serviceName: service.name,
              durationMin: service.durationMin,
              priceCents: service.priceCents,
              notes: dto.notes,
            },
            include: bookingInclude,
          }),
        );
        return toView(booking);
      } catch (error) {
        // Someone booked this staff member a moment ago: try the next one.
        if (isExclusionViolation(error, 'bookings_no_overlap')) continue;
        // Still deadlocking after the retries: the slot is heavily contested.
        if (isRetryableConflict(error)) throw slotTaken();
        throw error;
      }
    }
    throw slotTaken();
  }

  async findOne(bookingId: string, userId: string) {
    return toView(await this.findAccessible(bookingId, userId));
  }

  /** Cancels a future booking and frees its slot. Cancelling twice is a no-op. */
  async cancel(bookingId: string, userId: string, now = new Date()) {
    const booking = await this.findAccessible(bookingId, userId);
    if (booking.status === 'CANCELLED') return toView(booking);
    if (booking.startsAt <= now) {
      throw new ConflictException('Past bookings cannot be cancelled');
    }

    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'CANCELLED', cancelledAt: now },
      include: bookingInclude,
    });
    return toView(updated);
  }

  /**
   * Moves a booking to another time (and optionally another staff member) with
   * a single UPDATE: if the new time is taken, nothing changes. The booking
   * itself is ignored when checking availability, so it can move to a slot
   * that overlaps its current time.
   */
  async reschedule(
    bookingId: string,
    userId: string,
    dto: RescheduleBookingDto,
    now = new Date(),
  ) {
    const booking = await this.findAccessible(bookingId, userId);
    if (booking.status !== 'CONFIRMED') {
      throw new ConflictException('Only confirmed bookings can be rescheduled');
    }
    if (booking.startsAt <= now) {
      throw new ConflictException('Past bookings cannot be rescheduled');
    }

    const business = {
      id: booking.businessId,
      timezone: booking.business.timezone,
    };
    const service = await this.availability.findBookableService(
      booking.businessId,
      booking.serviceId,
    );
    const startsAt = new Date(dto.startsAt);
    const candidates = await this.freeStaffAt(startsAt, {
      business,
      service,
      staffId: dto.staffId ?? booking.staffId,
      now,
      excludeBookingId: booking.id,
    });

    for (const staffId of candidates) {
      try {
        const updated = await retryOnDeadlock(() =>
          this.prisma.booking.update({
            // Only if it is still confirmed (it may have been cancelled meanwhile).
            where: { id: booking.id, status: 'CONFIRMED' },
            data: { staffId, ...timesFor(startsAt, service) },
            include: bookingInclude,
          }),
        );
        return toView(updated);
      } catch (error) {
        if (isExclusionViolation(error, 'bookings_no_overlap')) continue;
        // Still deadlocking after the retries: the slot is heavily contested.
        if (isRetryableConflict(error)) throw slotTaken();
        if (isRecordNotFound(error)) {
          throw new ConflictException(
            'Only confirmed bookings can be rescheduled',
          );
        }
        throw error;
      }
    }
    throw slotTaken();
  }

  /** The customer's own bookings. */
  async listForCustomer(
    customerId: string,
    scope: 'upcoming' | 'past' | undefined,
    now = new Date(),
  ) {
    const bookings = await this.prisma.booking.findMany({
      where: {
        customerId,
        ...(scope === 'upcoming' ? { startsAt: { gte: now } } : {}),
        ...(scope === 'past' ? { startsAt: { lt: now } } : {}),
      },
      include: bookingInclude,
      orderBy: { startsAt: scope === 'past' ? 'desc' : 'asc' },
      take: 200,
    });
    return bookings.map(toView);
  }

  /** The business agenda between two local dates. */
  async listForBusiness(businessId: string, query: BusinessBookingsQuery) {
    const business = await this.prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { timezone: true },
    });
    const from = DateTime.fromISO(query.from, { zone: business.timezone });
    const to = DateTime.fromISO(query.to, { zone: business.timezone }).plus({
      days: 1,
    });

    const bookings = await this.prisma.booking.findMany({
      where: {
        businessId,
        startsAt: { gte: from.toJSDate(), lt: to.toJSDate() },
        ...(query.staffId ? { staffId: query.staffId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: bookingInclude,
      orderBy: { startsAt: 'asc' },
    });
    return bookings.map(toView);
  }

  // -------------------------------------------------------------------

  /**
   * Staff members free at exactly `startsAt`, according to the availability
   * engine. Empty or misaligned times (09:07), past times, time off and taken
   * slots all end up here as "not available".
   */
  private async freeStaffAt(
    startsAt: Date,
    search: Omit<
      Parameters<AvailabilityService['findSlots']>[0],
      'from' | 'to'
    >,
  ): Promise<string[]> {
    const localDate = DateTime.fromJSDate(startsAt, {
      zone: search.business.timezone,
    }).toISODate()!;
    const slots = await this.availability.findSlots({
      ...search,
      from: localDate,
      to: localDate,
    });
    const slot = slots.find((s) => Date.parse(s.start) === startsAt.getTime());
    if (!slot) throw new ConflictException('That time is not available');
    return slot.staffIds;
  }

  /**
   * Bookings are visible to their customer and to members of their business.
   * Anyone else gets 404, as if the booking didn't exist.
   */
  private async findAccessible(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        OR: [
          { customerId: userId },
          { business: { memberships: { some: { userId } } } },
        ],
      },
      include: bookingInclude,
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }
}

function timesFor(
  startsAt: Date,
  service: { durationMin: number; bufferMin: number },
) {
  const endsAt = new Date(startsAt.getTime() + service.durationMin * MINUTE_MS);
  const blockedUntil = new Date(
    endsAt.getTime() + service.bufferMin * MINUTE_MS,
  );
  return { startsAt, endsAt, blockedUntil };
}

function slotTaken() {
  return new ConflictException('That time was just booked by someone else');
}

function toView(b: BookingRow) {
  const local = DateTime.fromJSDate(b.startsAt, { zone: b.business.timezone });
  return {
    id: b.id,
    status: b.status,
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    localDate: local.toISODate(),
    localTime: local.toFormat('HH:mm'),
    business: b.business,
    service: {
      id: b.serviceId,
      name: b.serviceName,
      durationMin: b.durationMin,
      priceCents: b.priceCents,
    },
    staff: b.staff,
    customer: b.customer,
    notes: b.notes,
    cancelledAt: b.cancelledAt,
    createdAt: b.createdAt,
  };
}
