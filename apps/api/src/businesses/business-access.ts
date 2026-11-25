import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth-user.js';
import type { Membership, MemberRole } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

type BusinessRequest = Request & { user: AuthUser; membership?: Membership };

const ROLES_KEY = 'businessRoles';

/** Restricts a business route to some roles. Without it, any member can access. */
export const BusinessRoles = (...roles: MemberRole[]) =>
  SetMetadata(ROLES_KEY, roles);

/** Injects the current user's membership in the business of the route. */
export const CurrentMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest<BusinessRequest>().membership,
);

const uuid = z.uuid();

/**
 * Tenant isolation for every `/businesses/:businessId/...` route.
 *
 * - Not a member (or the business doesn't exist): 404, so outsiders can't even
 *   tell whether a business id exists.
 * - Member without the required role: 403.
 *
 * Services still scope every query by `businessId`: the guard proves the user
 * belongs to the business, the query makes sure a record belongs to it too.
 */
@Injectable()
export class BusinessAccessGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<BusinessRequest>();
    const businessId = request.params.businessId;
    if (typeof businessId !== 'string' || !uuid.safeParse(businessId).success) {
      throw businessNotFound();
    }

    const membership = await this.prisma.membership.findUnique({
      where: { businessId_userId: { businessId, userId: request.user.id } },
    });
    if (!membership) throw businessNotFound();

    const roles = this.reflector.getAllAndOverride<MemberRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (roles && !roles.includes(membership.role)) {
      throw new ForbiddenException(`Requires role: ${roles.join(' or ')}`);
    }

    request.membership = membership;
    return true;
  }
}

function businessNotFound() {
  return new NotFoundException('Business not found');
}
