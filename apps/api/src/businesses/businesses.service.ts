import { randomBytes } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUniqueViolation } from '../common/prisma-errors.js';
import { slugify } from '../common/slug.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateBusinessDto,
  UpdateBusinessDto,
} from './businesses.schemas.js';

const businessSelect = {
  id: true,
  name: true,
  slug: true,
  timezone: true,
  createdAt: true,
} as const;

@Injectable()
export class BusinessesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates the business and makes its creator the first OWNER, atomically. */
  async create(userId: string, dto: CreateBusinessDto) {
    const slug = dto.slug ?? (await this.availableSlugFor(dto.name));
    try {
      return await this.prisma.$transaction(async (tx) => {
        const business = await tx.business.create({
          data: { name: dto.name, slug, timezone: dto.timezone },
          select: businessSelect,
        });
        await tx.membership.create({
          data: { businessId: business.id, userId, role: 'OWNER' },
        });
        return { ...business, role: 'OWNER' as const };
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw slugTaken();
      throw error;
    }
  }

  /** Businesses the user belongs to, with their role in each. */
  async listForUser(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      select: { role: true, business: { select: businessSelect } },
      orderBy: { business: { name: 'asc' } },
    });
    return memberships.map(({ role, business }) => ({ ...business, role }));
  }

  async findById(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: businessSelect,
    });
    if (!business) throw new NotFoundException('Business not found');
    return business;
  }

  async update(businessId: string, dto: UpdateBusinessDto) {
    try {
      return await this.prisma.business.update({
        where: { id: businessId },
        data: dto,
        select: businessSelect,
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw slugTaken();
      throw error;
    }
  }

  /** Public profile for the booking page: only active services and staff. */
  async findPublicBySlug(slug: string) {
    const business = await this.prisma.business.findUnique({
      where: { slug },
      select: {
        name: true,
        slug: true,
        timezone: true,
        services: {
          where: { active: true },
          select: {
            id: true,
            name: true,
            description: true,
            durationMin: true,
            priceCents: true,
          },
          orderBy: { name: 'asc' },
        },
        staff: {
          where: { active: true },
          select: {
            id: true,
            name: true,
            services: {
              where: { service: { active: true } },
              select: { serviceId: true },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!business) throw new NotFoundException('Business not found');

    return {
      ...business,
      staff: business.staff.map(({ services, ...staff }) => ({
        ...staff,
        serviceIds: services.map((s) => s.serviceId),
      })),
    };
  }

  /** The slugified name, or the name plus a short random suffix if it's taken. */
  private async availableSlugFor(name: string): Promise<string> {
    const base = slugify(name) || 'business';
    const taken = await this.prisma.business.findUnique({
      where: { slug: base },
      select: { id: true },
    });
    return taken
      ? `${base.slice(0, 54)}-${randomBytes(3).toString('hex')}`
      : base;
  }
}

function slugTaken() {
  return new ConflictException('That slug is already in use');
}
