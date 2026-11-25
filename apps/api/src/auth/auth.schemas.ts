import { z } from 'zod';

// `.meta({ example })` only feeds the Swagger docs: it shows realistic values
// that pass validation when someone tries the endpoints from /docs.

const email = z
  .email()
  .max(254)
  .toLowerCase()
  .meta({ example: 'ana@example.com' });

export const registerSchema = z.strictObject({
  email,
  password: z.string().min(8).max(128).meta({ example: 'supersecret123' }),
  name: z.string().trim().min(1).max(100).meta({ example: 'Ana García' }),
});
export type RegisterDto = z.infer<typeof registerSchema>;

export const loginSchema = z.strictObject({
  email,
  password: z.string().min(1).max(128).meta({ example: 'supersecret123' }),
});
export type LoginDto = z.infer<typeof loginSchema>;

export const refreshTokenSchema = z.strictObject({
  refreshToken: z
    .string()
    .min(1)
    .max(200)
    .meta({ example: 'paste the refreshToken from /auth/login' }),
});
export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;

export const tokenPairSchema = z.object({
  tokenType: z.literal('Bearer'),
  accessToken: z.string().meta({ example: 'eyJhbGciOiJIUzI1NiIs...' }),
  /** Seconds until the access token expires. */
  expiresIn: z.number().int().positive().meta({ example: 900 }),
  refreshToken: z.string().meta({ example: 'kq3J8f...' }),
});
export type TokenPair = z.infer<typeof tokenPairSchema>;
