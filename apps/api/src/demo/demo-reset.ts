import { randomBytes, randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import type { PrismaClient } from '../generated/prisma/client.js';
import { buildDemoData, DEMO_BUSINESS_ID } from './demo-data.js';

export interface DemoOwner {
  email: string;
  password: string;
}

export interface DemoResetResult {
  businessId: string;
  services: number;
  staff: number;
  bookings: number;
}

/**
 * Deletes the demo business and creates it again from `buildDemoData`, in one
 * transaction: visitors sign in as its owner and can change anything, so the
 * demo is put back in shape every night (and on demand).
 *
 * - The business keeps a fixed id, so dashboard links keep working.
 * - The owner account is upserted with the configured password.
 * - Accounts that visitors created are left alone; only their bookings at the
 *   demo business go away with it.
 */
export async function resetDemo(
  prisma: PrismaClient,
  owner: DemoOwner,
  now = new Date(),
): Promise<DemoResetResult> {
  const data = buildDemoData(now);
  const ownerHash = await hash(owner.password);
  // Seeded customers never sign in: a random password nobody knows.
  const customerHash = await hash(randomBytes(32).toString('base64url'));

  return prisma.$transaction(
    async (tx) => {
      // Bookings first: they reference staff and services with ON DELETE RESTRICT.
      await tx.booking.deleteMany({ where: { businessId: DEMO_BUSINESS_ID } });
      await tx.business.deleteMany({ where: { id: DEMO_BUSINESS_ID } });

      // A visitor may have renamed the demo, then someone took its slug.
      const squatter = await tx.business.findUnique({
        where: { slug: data.business.slug },
        select: { id: true },
      });
      if (squatter) {
        await tx.business.update({
          where: { id: squatter.id },
          data: {
            slug: `${data.business.slug}-${randomUUID().slice(0, 6)}`,
          },
        });
      }

      const ownerUser = await tx.user.upsert({
        where: { email: owner.email.toLowerCase() },
        create: {
          email: owner.email.toLowerCase(),
          name: 'Demo Owner',
          passwordHash: ownerHash,
        },
        update: { name: 'Demo Owner', passwordHash: ownerHash },
        select: { id: true },
      });

      await tx.business.create({
        data: {
          ...data.business,
          memberships: { create: { userId: ownerUser.id, role: 'OWNER' } },
        },
      });
      await tx.service.createMany({
        data: data.services.map((s) => ({
          ...s,
          businessId: data.business.id,
        })),
      });
      await tx.staffMember.createMany({
        data: data.staff.map((s) => ({ ...s, businessId: data.business.id })),
      });
      await tx.staffService.createMany({ data: data.staffServices });
      await tx.workingHours.createMany({ data: data.workingHours });

      // Customers are matched by email, so their ids may differ from the generated ones.
      const customerIds = new Map<string, string>();
      for (const c of data.customers) {
        const user = await tx.user.upsert({
          where: { email: c.email },
          create: { email: c.email, name: c.name, passwordHash: customerHash },
          update: { name: c.name },
          select: { id: true },
        });
        customerIds.set(c.id, user.id);
      }

      await tx.booking.createMany({
        data: data.bookings.map((b) => ({
          ...b,
          businessId: data.business.id,
          customerId: customerIds.get(b.customerId)!,
          // No reminder emails for seeded bookings.
          reminderSentAt: now,
        })),
      });

      return {
        businessId: data.business.id,
        services: data.services.length,
        staff: data.staff.length,
        bookings: data.bookings.length,
      };
    },
    { timeout: 30_000 },
  );
}
