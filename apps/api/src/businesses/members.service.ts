import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUniqueViolation } from '../common/prisma-errors.js';
import type { MemberRole } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AddMemberDto } from './businesses.schemas.js';

type Tx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

const memberSelect = {
  role: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true } },
} as const;

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(businessId: string) {
    const members = await this.prisma.membership.findMany({
      where: { businessId },
      select: memberSelect,
      orderBy: { createdAt: 'asc' },
    });
    return members.map(toMember);
  }

  /** Adds an existing user (looked up by email) to the business. */
  async add(businessId: string, dto: AddMemberDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (!user)
      throw new NotFoundException('No user registered with that email');

    try {
      const member = await this.prisma.membership.create({
        data: { businessId, userId: user.id, role: dto.role },
        select: memberSelect,
      });
      return toMember(member);
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException('User is already a member');
      throw error;
    }
  }

  async changeRole(businessId: string, userId: string, role: MemberRole) {
    return this.prisma.$transaction(async (tx) => {
      await lockBusiness(tx, businessId);
      const current = await this.findMembership(tx, businessId, userId);
      if (current.role === 'OWNER' && role !== 'OWNER') {
        await this.ensureAnotherOwner(tx, businessId);
      }
      const member = await tx.membership.update({
        where: { id: current.id },
        data: { role },
        select: memberSelect,
      });
      return toMember(member);
    });
  }

  async remove(businessId: string, userId: string) {
    await this.prisma.$transaction(async (tx) => {
      await lockBusiness(tx, businessId);
      const current = await this.findMembership(tx, businessId, userId);
      if (current.role === 'OWNER')
        await this.ensureAnotherOwner(tx, businessId);
      await tx.membership.delete({ where: { id: current.id } });
    });
  }

  private async findMembership(tx: Tx, businessId: string, userId: string) {
    const membership = await tx.membership.findUnique({
      where: { businessId_userId: { businessId, userId } },
    });
    if (!membership) throw new NotFoundException('Member not found');
    return membership;
  }

  /** A business must always keep at least one owner. */
  private async ensureAnotherOwner(tx: Tx, businessId: string) {
    const owners = await tx.membership.count({
      where: { businessId, role: 'OWNER' },
    });
    if (owners <= 1)
      throw new ConflictException('A business needs at least one owner');
  }
}

/**
 * Serializes membership changes of one business. Without it, two owners
 * removing each other at the same time would both count "2 owners", both
 * succeed, and leave the business with none. `FOR UPDATE` makes the second
 * transaction wait until the first commits, so it counts the real number.
 */
async function lockBusiness(tx: Tx, businessId: string) {
  await tx.$queryRaw`SELECT id FROM businesses WHERE id = ${businessId}::uuid FOR UPDATE`;
}

function toMember(m: {
  role: MemberRole;
  createdAt: Date;
  user: { id: string; name: string; email: string };
}) {
  return {
    userId: m.user.id,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    since: m.createdAt,
  };
}
