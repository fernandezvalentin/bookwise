import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateServiceDto, UpdateServiceDto } from './services.schemas.js';

const serviceSelect = {
  id: true,
  name: true,
  description: true,
  durationMin: true,
  bufferMin: true,
  priceCents: true,
  active: true,
} as const;

/** The services (catalog items) a business offers. Every query is scoped by businessId. */
@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  list(businessId: string, includeArchived: boolean) {
    return this.prisma.service.findMany({
      where: { businessId, ...(includeArchived ? {} : { active: true }) },
      select: serviceSelect,
      orderBy: { name: 'asc' },
    });
  }

  create(businessId: string, dto: CreateServiceDto) {
    return this.prisma.service.create({
      data: { ...dto, businessId },
      select: serviceSelect,
    });
  }

  async update(businessId: string, serviceId: string, dto: UpdateServiceDto) {
    await this.ensureExists(businessId, serviceId);
    return this.prisma.service.update({
      where: { id: serviceId },
      data: dto,
      select: serviceSelect,
    });
  }

  /**
   * Archives instead of deleting: bookings will reference services, and the
   * history has to keep making sense. Archived services can't be booked.
   */
  async archive(businessId: string, serviceId: string) {
    await this.ensureExists(businessId, serviceId);
    await this.prisma.service.update({
      where: { id: serviceId },
      data: { active: false },
    });
  }

  private async ensureExists(businessId: string, serviceId: string) {
    const found = await this.prisma.service.findFirst({
      where: { id: serviceId, businessId },
      select: { id: true },
    });
    // Same 404 for "doesn't exist" and "belongs to another business".
    if (!found) throw new NotFoundException('Service not found');
  }
}
