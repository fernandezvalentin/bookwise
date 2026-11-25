import { Injectable, NotFoundException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AvailabilityQuery } from './availability.schemas.js';
import { computeAvailableSlots, type BusyPeriod } from './compute-slots.js';

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Loads everything the engine needs for one service and date range, then
   * delegates the calculation to the pure `computeAvailableSlots`.
   */
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

    const service = await this.prisma.service.findFirst({
      where: { id: query.serviceId, businessId: business.id, active: true },
      select: { id: true, durationMin: true, bufferMin: true },
    });
    if (!service) throw new NotFoundException('Service not found');

    const staff = await this.prisma.staffMember.findMany({
      where: {
        businessId: business.id,
        active: true,
        services: { some: { serviceId: service.id } },
        ...(query.staffId ? { id: query.staffId } : {}),
      },
      select: {
        id: true,
        workingHours: {
          select: { weekday: true, startMinute: true, endMinute: true },
        },
      },
    });
    if (query.staffId && staff.length === 0) {
      throw new NotFoundException(
        'Staff member not found or does not provide this service',
      );
    }

    // Busy periods that could touch the requested local days. One extra day on
    // each side covers any time zone offset and appointments crossing midnight.
    const windowStart = DateTime.fromISO(query.from, {
      zone: business.timezone,
    })
      .minus({ days: 1 })
      .toJSDate();
    const windowEnd = DateTime.fromISO(query.to, { zone: business.timezone })
      .plus({ days: 2 })
      .toJSDate();
    const busyByStaff = await this.findBusyPeriods(
      staff.map((s) => s.id),
      windowStart,
      windowEnd,
    );

    const slots = computeAvailableSlots({
      timezone: business.timezone,
      durationMin: service.durationMin,
      bufferMin: service.bufferMin,
      fromDate: query.from,
      toDate: query.to,
      // Only future slots can be booked.
      earliestStart: now,
      staff: staff.map((s) => ({
        staffId: s.id,
        workingHours: s.workingHours,
        busy: busyByStaff.get(s.id) ?? [],
      })),
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

  /** Time off per staff member overlapping the window. Bookings join in stage 4. */
  private async findBusyPeriods(staffIds: string[], from: Date, to: Date) {
    const timeOff = await this.prisma.timeOff.findMany({
      where: {
        staffId: { in: staffIds },
        startsAt: { lt: to },
        endsAt: { gt: from },
      },
      select: { staffId: true, startsAt: true, endsAt: true },
    });

    const byStaff = new Map<string, BusyPeriod[]>();
    for (const { staffId, startsAt, endsAt } of timeOff) {
      const list = byStaff.get(staffId) ?? [];
      list.push({ startsAt, endsAt });
      byStaff.set(staffId, list);
    }
    return byStaff;
  }
}
