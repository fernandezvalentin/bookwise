import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { minutesToTime, timeToMinutes } from '../common/time.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateStaffDto,
  CreateTimeOffDto,
  UpdateStaffDto,
  WeeklyScheduleDto,
} from './staff.schemas.js';

type Tx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

const staffSelect = {
  id: true,
  name: true,
  active: true,
  services: { select: { serviceId: true } },
} as const;

type StaffRow = {
  id: string;
  name: string;
  active: boolean;
  services: { serviceId: string }[];
};

/** Staff members, their weekly hours and their time off. Scoped by businessId. */
@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async list(businessId: string, includeInactive: boolean) {
    const staff = await this.prisma.staffMember.findMany({
      where: { businessId, ...(includeInactive ? {} : { active: true }) },
      select: staffSelect,
      orderBy: { name: 'asc' },
    });
    return staff.map(toStaff);
  }

  async create(businessId: string, dto: CreateStaffDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.ensureServicesBelong(tx, businessId, dto.serviceIds);
      const staff = await tx.staffMember.create({
        data: {
          businessId,
          name: dto.name,
          services: {
            create: dto.serviceIds.map((serviceId) => ({ serviceId })),
          },
        },
        select: staffSelect,
      });
      return toStaff(staff);
    });
  }

  async update(businessId: string, staffId: string, dto: UpdateStaffDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.ensureStaffExists(tx, businessId, staffId);
      if (dto.serviceIds) {
        await this.ensureServicesBelong(tx, businessId, dto.serviceIds);
        await tx.staffService.deleteMany({ where: { staffId } });
        await tx.staffService.createMany({
          data: dto.serviceIds.map((serviceId) => ({ staffId, serviceId })),
        });
      }
      const staff = await tx.staffMember.update({
        where: { id: staffId },
        data: { name: dto.name, active: dto.active },
        select: staffSelect,
      });
      return toStaff(staff);
    });
  }

  /** Deactivates instead of deleting, for the same reason as services: bookings point to staff. */
  async deactivate(businessId: string, staffId: string) {
    await this.ensureStaffExists(this.prisma, businessId, staffId);
    await this.prisma.staffMember.update({
      where: { id: staffId },
      data: { active: false },
    });
  }

  // -------------------------------------------------------------------
  //  Working hours
  // -------------------------------------------------------------------

  async getWeeklySchedule(businessId: string, staffId: string) {
    await this.ensureStaffExists(this.prisma, businessId, staffId);
    const rows = await this.prisma.workingHours.findMany({
      where: { staffId },
      orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
    });
    return rows.map((r) => ({
      weekday: r.weekday,
      start: minutesToTime(r.startMinute),
      end: minutesToTime(r.endMinute),
    }));
  }

  /** Replaces the whole weekly schedule in one transaction: never half-updated. */
  async replaceWeeklySchedule(
    businessId: string,
    staffId: string,
    schedule: WeeklyScheduleDto,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await this.ensureStaffExists(tx, businessId, staffId);
      await tx.workingHours.deleteMany({ where: { staffId } });
      await tx.workingHours.createMany({
        data: schedule.map((i) => ({
          staffId,
          weekday: i.weekday,
          startMinute: timeToMinutes(i.start),
          endMinute: timeToMinutes(i.end),
        })),
      });
    });
    return this.getWeeklySchedule(businessId, staffId);
  }

  // -------------------------------------------------------------------
  //  Time off
  // -------------------------------------------------------------------

  async listTimeOff(businessId: string, staffId: string) {
    await this.ensureStaffExists(this.prisma, businessId, staffId);
    return this.prisma.timeOff.findMany({
      // Past time off is irrelevant for scheduling; keep the list short.
      where: { staffId, endsAt: { gt: new Date() } },
      select: timeOffSelect,
      orderBy: { startsAt: 'asc' },
    });
  }

  async addTimeOff(businessId: string, staffId: string, dto: CreateTimeOffDto) {
    await this.ensureStaffExists(this.prisma, businessId, staffId);
    return this.prisma.timeOff.create({
      data: {
        staffId,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        reason: dto.reason,
      },
      select: timeOffSelect,
    });
  }

  async removeTimeOff(businessId: string, staffId: string, timeOffId: string) {
    const { count } = await this.prisma.timeOff.deleteMany({
      where: { id: timeOffId, staffId, staff: { businessId } },
    });
    if (count === 0) throw new NotFoundException('Time off not found');
  }

  // -------------------------------------------------------------------

  private async ensureStaffExists(
    db: Tx | PrismaService,
    businessId: string,
    staffId: string,
  ) {
    const found = await db.staffMember.findFirst({
      where: { id: staffId, businessId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Staff member not found');
  }

  /** Rejects service ids from another business (or that don't exist). */
  private async ensureServicesBelong(
    tx: Tx,
    businessId: string,
    serviceIds: string[],
  ) {
    if (serviceIds.length === 0) return;
    const count = await tx.service.count({
      where: { id: { in: serviceIds }, businessId },
    });
    if (count !== serviceIds.length) {
      throw new BadRequestException(
        'Some serviceIds do not belong to this business',
      );
    }
  }
}

const timeOffSelect = {
  id: true,
  startsAt: true,
  endsAt: true,
  reason: true,
} as const;

function toStaff({ services, ...staff }: StaffRow) {
  return { ...staff, serviceIds: services.map((s) => s.serviceId) };
}
