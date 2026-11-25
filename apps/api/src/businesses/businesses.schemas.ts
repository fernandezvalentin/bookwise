import { z } from 'zod';
import { slugSchema } from '../common/slug.js';
import { isValidTimeZone } from '../common/time.js';

export const timezoneSchema = z
  .string()
  .refine(isValidTimeZone, 'Invalid IANA time zone')
  .meta({ example: 'America/Argentina/Buenos_Aires' });

export const businessIdParam = z.uuid();

export const createBusinessSchema = z.strictObject({
  name: z.string().trim().min(2).max(100).meta({ example: 'Barbería Centro' }),
  /** Optional: generated from the name when missing. */
  slug: slugSchema.optional(),
  timezone: timezoneSchema,
});
export type CreateBusinessDto = z.infer<typeof createBusinessSchema>;

export const updateBusinessSchema = z
  .strictObject({
    name: z.string().trim().min(2).max(100),
    slug: slugSchema,
    timezone: timezoneSchema,
  })
  .partial();
export type UpdateBusinessDto = z.infer<typeof updateBusinessSchema>;

export const memberRoleSchema = z.enum(['OWNER', 'STAFF']);

export const addMemberSchema = z.strictObject({
  email: z.email().toLowerCase().meta({ example: 'colleague@example.com' }),
  role: memberRoleSchema,
});
export type AddMemberDto = z.infer<typeof addMemberSchema>;

export const updateMemberSchema = z.strictObject({ role: memberRoleSchema });
export type UpdateMemberDto = z.infer<typeof updateMemberSchema>;
