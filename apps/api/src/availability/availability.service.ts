import { Injectable, NotFoundException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AvailabilityQuery } from './availability.schemas.js';
import {
  computeAvailableSlots,
  type BusyPeriod,
  type Slot,
} from './compute-slots.js';

export interface SlotSearch {
  business: { id: string; timezone: string };
  service: { id: string; durationMin: number; bufferMin: number };
  /** Only this staff member; otherwise anyone who provides the service. */
  staffId?: string;
  /** Local dates (YYYY-MM-DD) in the business's time zone, inclusive. */
  from: string;
  to: string;
  now: Date;
  /** Ignore this booking when rescheduling it (it shouldn't block itself). */
  excludeBookingId?: string;
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public endpoint: resolves the business and service, then finds the slots. */
  async forPublicBooking(
    slug: string,
    query: AvailabilityQuery,
    now = new Date(),
  ) {
    const business = await this.prisma.business.findUnique({
      where: { slug },
      select: { id: true, timezone: true },
    });
    if (!business) throw new NotFoundException('Business not found');

    const service = await this.findBookableService(
      business.id,
      query.serviceId,
    );
    const slots = await this.findSlots({
      business,
      service,
      staffId: query.staffId,
      from: query.from,
      to: query.to,
      now,
    });

    return {
      timezone: business.timezone,
      serviceId: service.id,
      durationMin: service.durationMin,
      from: query.from,
      to: query.to,
      slots,
    };
  }

  async findBookableService(businessId: string, serviceId: string) {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, businessId, active: true },
      select: {
        id: true,
        name: true,
        durationMin: true,
        bufferMin: true,
        priceCents: true,
      },
    });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  /**
   * Loads everything the engine needs (working hours, time off, bookings) and
   * delegates the calculation to the pure `computeAvailableSlots`.
   */
  async findSlots(search: SlotSearch): Promise<Slot[]> {
    const { business, service } = search;
    const staff = await this.prisma.staffMember.findMany({
      where: {
        businessId: business.id,
        active: true,
        services: { some: { serviceId: service.id } },
        ...(search.staffId ? { id: search.staffId } : {}),
      },
      select: {
        id: true,
        workingHours: {
          select: { weekday: true, startMinute: true, endMinute: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    if (search.staffId && staff.length === 0) {
      throw new NotFoundException(
        'Staff member not found or does not provide this service',
      );
    }

    // Busy periods that could touch the requested local days. One extra day on
    // each side covers any time zone offset and appointments crossing midnight.
    const windowStart = DateTime.fromISO(search.from, {
      zone: business.timezone,
    })
      .minus({ days: 1 })
      .toJSDate();
    const windowEnd = DateTime.fromISO(search.to, { zone: business.timezone })
      .plus({ days: 2 })
      .toJSDate();
    const busyByStaff = await this.findBusyPeriods(
      staff.map((s) => s.id),
      windowStart,
      windowEnd,
      search.excludeBookingId,
    );

    return computeAvailableSlots({
      timezone: business.timezone,
      durationMin: service.durationMin,
      bufferMin: service.bufferMin,
      fromDate: search.from,
      toDate: search.to,
      // Only future slots can be booked.
      earliestStart: search.now,
      staff: staff.map((s) => ({
        staffId: s.id,
        workingHours: s.workingHours,
        busy: busyByStaff.get(s.id) ?? [],
      })),
    });
  }

  /** Time off and confirmed bookings (including their buffer) per staff member. */
  private async findBusyPeriods(
    staffIds: string[],
    from: Date,
    to: Date,
    excludeBookingId?: string,
  ) {
    const [timeOff, bookings] = await Promise.all([
      this.prisma.timeOff.findMany({
        where: {
          staffId: { in: staffIds },
          startsAt: { lt: to },
          endsAt: { gt: from },
        },
        select: { staffId: true, startsAt: true, endsAt: true },
      }),
      this.prisma.booking.findMany({
        where: {
          staffId: { in: staffIds },
          status: 'CONFIRMED',
          startsAt: { lt: to },
          blockedUntil: { gt: from },
          ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
        },
        select: { staffId: true, startsAt: true, blockedUntil: true },
      }),
    ]);

    const byStaff = new Map<string, BusyPeriod[]>();
    const add = (staffId: string, period: BusyPeriod) => {
      const list = byStaff.get(staffId) ?? [];
      list.push(period);
      byStaff.set(staffId, list);
    };
    for (const t of timeOff) {
      add(t.staffId, { startsAt: t.startsAt, endsAt: t.endsAt });
    }
    for (const b of bookings) {
      add(b.staffId, { startsAt: b.startsAt, endsAt: b.blockedUntil });
    }
    return byStaff;
  }
}
