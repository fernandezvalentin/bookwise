import { z } from 'zod';

export const createServiceSchema = z.strictObject({
  name: z.string().trim().min(1).max(100).meta({ example: 'Haircut' }),
  description: z.string().trim().max(500).nullable().optional(),
  /** Appointment length in minutes, in steps of 5. */
  durationMin: z
    .number()
    .int()
    .min(5)
    .max(480)
    .multipleOf(5)
    .meta({ example: 30 }),
  /** Minutes blocked after each appointment. */
  bufferMin: z
    .number()
    .int()
    .min(0)
    .max(240)
    .multipleOf(5)
    .default(0)
    .meta({ example: 5 }),
  /** Price in cents: 1500000 = $15,000.00 */
  priceCents: z
    .number()
    .int()
    .min(0)
    .max(100_000_000)
    .meta({ example: 1_500_000 }),
});
export type CreateServiceDto = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = z
  .strictObject({
    name: createServiceSchema.shape.name,
    description: createServiceSchema.shape.description,
    durationMin: createServiceSchema.shape.durationMin,
    bufferMin: z.number().int().min(0).max(240).multipleOf(5),
    priceCents: createServiceSchema.shape.priceCents,
    active: z.boolean(),
  })
  .partial();
export type UpdateServiceDto = z.infer<typeof updateServiceSchema>;
